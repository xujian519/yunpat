use crate::models::{HITLRequest, HITLResponse};
use std::collections::HashMap;
/**
 * @file HITL 管理服务
 */
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

struct PendingHITL {
    request: HITLRequest,
    response_tx: oneshot::Sender<HITLResponse>,
    timeout_handle: tokio::task::AbortHandle,
}

pub struct HITLManager {
    pending: Arc<Mutex<HashMap<String, PendingHITL>>>,
}

impl HITLManager {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 注册 HITL 请求，等待响应
    pub async fn register_request(&self, request: HITLRequest) -> oneshot::Receiver<HITLResponse> {
        let (tx, rx) = oneshot::channel();

        // 设置超时任务，保存 abort handle 以便在响应后取消
        let request_id = request.request_id.clone();
        let pending_clone = self.pending.clone();
        let timeout_handle = tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(request.timeout)).await;
            let mut pending = pending_clone.lock().await;
            // 仅在请求仍在等待时才移除（超时清理）
            if pending.contains_key(&request_id) {
                pending.remove(&request_id);
            }
        })
        .abort_handle();

        let pending = PendingHITL {
            request: request.clone(),
            response_tx: tx,
            timeout_handle,
        };

        self.pending
            .lock()
            .await
            .insert(request.request_id.clone(), pending);

        rx
    }

    /// 提交 HITL 响应
    pub async fn submit_response(&self, response: HITLResponse) -> Result<(), String> {
        let pending = self
            .pending
            .lock()
            .await
            .remove(&response.request_id)
            .ok_or("Request not found")?;

        // 取消超时任务
        pending.timeout_handle.abort();

        pending
            .response_tx
            .send(response)
            .map_err(|_| "Receiver dropped")?;
        Ok(())
    }

    /// 获取待处理的 HITL 请求
    pub async fn get_pending(&self, session_id: &str) -> Vec<HITLRequest> {
        self.pending
            .lock()
            .await
            .values()
            .filter(|p| p.request.session_id == session_id)
            .map(|p| p.request.clone())
            .collect()
    }

    /// 取消 HITL 请求
    pub async fn cancel(&self, request_id: &str) -> Option<HITLRequest> {
        self.pending
            .lock()
            .await
            .remove(request_id)
            .map(|p| p.request)
    }
}

impl Default for HITLManager {
    fn default() -> Self {
        Self::new()
    }
}
