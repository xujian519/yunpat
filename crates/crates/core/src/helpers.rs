use serde_json::{Value, json};
use yunpat_execpolicy::{ExecApprovalRequirement, ExecPolicyDecision};
use yunpat_protocol::{EventFrame, ExecApprovalRequestEvent, ReviewDecision, ToolPayload};

pub(crate) fn thread_response_from_new(
    status: &str,
    new: crate::NewThread,
) -> yunpat_protocol::ThreadResponse {
    yunpat_protocol::ThreadResponse {
        thread_id: new.thread.id.clone(),
        status: status.to_string(),
        thread: Some(new.thread),
        threads: Vec::new(),
        model: Some(new.model),
        model_provider: Some(new.model_provider),
        cwd: Some(new.cwd),
        approval_policy: new.approval_policy,
        sandbox: new.sandbox,
        events: Vec::new(),
        data: json!({}),
    }
}

pub(crate) fn approval_request_frame(
    requirement: &ExecApprovalRequirement,
    call_id: String,
    approval_id: String,
    turn_id: String,
    command: String,
    cwd: String,
) -> Option<EventFrame> {
    let ExecApprovalRequirement::NeedsApproval {
        reason,
        proposed_execpolicy_amendment,
        proposed_network_policy_amendments,
    } = requirement
    else {
        return None;
    };

    let mut available_decisions = vec![
        ReviewDecision::Approved,
        ReviewDecision::ApprovedForSession,
        ReviewDecision::Denied,
        ReviewDecision::Abort,
    ];
    if proposed_execpolicy_amendment
        .as_ref()
        .is_some_and(|amendment| !amendment.prefixes.is_empty())
    {
        available_decisions.push(ReviewDecision::ApprovedExecpolicyAmendment);
    }
    available_decisions.extend(proposed_network_policy_amendments.iter().cloned().map(
        |amendment| ReviewDecision::NetworkPolicyAmendment {
            host: amendment.host,
            action: amendment.action,
        },
    ));

    Some(EventFrame::ExecApprovalRequest {
        request: ExecApprovalRequestEvent {
            call_id,
            approval_id,
            turn_id,
            command,
            cwd,
            reason: reason.clone(),
            network_approval_context: None,
            proposed_execpolicy_amendment: proposed_execpolicy_amendment
                .as_ref()
                .map(|amendment| amendment.prefixes.clone())
                .unwrap_or_default(),
            proposed_network_policy_amendments: proposed_network_policy_amendments.clone(),
            additional_permissions: Vec::new(),
            available_decisions,
        },
    })
}

pub(crate) fn approval_requirement_payload(requirement: &ExecApprovalRequirement) -> Value {
    match requirement {
        ExecApprovalRequirement::Skip {
            bypass_sandbox,
            proposed_execpolicy_amendment,
        } => json!({
            "type": "skip",
            "bypass_sandbox": bypass_sandbox,
            "reason": requirement.reason(),
            "proposed_execpolicy_amendment": proposed_execpolicy_amendment
                .as_ref()
                .map(|amendment| amendment.prefixes.clone())
                .unwrap_or_default()
        }),
        ExecApprovalRequirement::NeedsApproval {
            reason,
            proposed_execpolicy_amendment,
            proposed_network_policy_amendments,
        } => json!({
            "type": "needs_approval",
            "reason": reason,
            "proposed_execpolicy_amendment": proposed_execpolicy_amendment
                .as_ref()
                .map(|amendment| amendment.prefixes.clone())
                .unwrap_or_default(),
            "proposed_network_policy_amendments": proposed_network_policy_amendments
        }),
        ExecApprovalRequirement::Forbidden { reason } => json!({
            "type": "forbidden",
            "reason": reason
        }),
    }
}

pub(crate) fn policy_precheck_payload(
    decision: &ExecPolicyDecision,
    command: &str,
    cwd: &str,
    execution_kind: &str,
) -> Value {
    json!({
        "execution_kind": execution_kind,
        "command": command,
        "cwd": cwd,
        "allow": decision.allow,
        "requires_approval": decision.requires_approval,
        "matched_rule": decision.matched_rule.clone(),
        "phase": decision.requirement.phase(),
        "reason": decision.reason(),
        "requirement": approval_requirement_payload(&decision.requirement)
    })
}

pub(crate) fn tool_payload_value(payload: &ToolPayload) -> Value {
    serde_json::to_value(payload).unwrap_or_else(
        |_| json!({"type":"serialization_error","message":"tool payload unavailable"}),
    )
}

pub(crate) fn tool_output_value(output: &yunpat_protocol::ToolOutput) -> Value {
    serde_json::to_value(output).unwrap_or_else(
        |_| json!({"type":"serialization_error","message":"tool output unavailable"}),
    )
}

pub(crate) fn event_frame_payload(frame: &EventFrame) -> Value {
    serde_json::to_value(frame)
        .unwrap_or_else(|_| json!({"event":"error","message":"failed to encode event frame"}))
}
