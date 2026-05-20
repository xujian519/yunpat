#![allow(dead_code)]

use std::time::Instant;

/// Patent workflow specific state
#[derive(Debug, Clone, Default)]
pub struct PatentWorkflowState {
    pub is_active: bool,
    pub workflow_type: Option<String>,
    pub current_step_index: usize,
    pub total_steps: usize,
    pub steps: Vec<WorkflowStep>,
    pub start_time: Option<Instant>,
    pub active_case_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    pub status: StepStatus,
    pub progress: f32, // 0.0 to 1.0
    pub duration_ms: Option<u64>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    WaitingHitl,
}

impl PatentWorkflowState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start_workflow(&mut self, workflow_type: String, steps: Vec<String>) {
        self.is_active = true;
        self.workflow_type = Some(workflow_type);
        self.total_steps = steps.len();
        self.current_step_index = 0;
        self.start_time = Some(Instant::now());

        self.steps = steps
            .into_iter()
            .map(|name| WorkflowStep {
                id: name.to_lowercase().replace(" ", "_"),
                name,
                status: StepStatus::Pending,
                progress: 0.0,
                duration_ms: None,
                details: None,
            })
            .collect();

        if !self.steps.is_empty() {
            self.steps[0].status = StepStatus::Running;
        }
    }

    pub fn complete_workflow(&mut self) {
        self.is_active = false;
        for step in &mut self.steps {
            if step.status == StepStatus::Running || step.status == StepStatus::WaitingHitl {
                step.status = StepStatus::Completed;
                step.progress = 1.0;
            }
        }
    }

    pub fn update_step_progress(
        &mut self,
        step_index: usize,
        progress: f32,
        details: Option<String>,
    ) {
        if step_index < self.steps.len() {
            self.steps[step_index].progress = progress;
            if let Some(d) = details {
                self.steps[step_index].details = Some(d);
            }
        }
    }

    pub fn complete_step(&mut self, step_index: usize) {
        if step_index < self.steps.len() {
            self.steps[step_index].status = StepStatus::Completed;
            self.steps[step_index].progress = 1.0;
            if step_index + 1 < self.steps.len() {
                self.current_step_index = step_index + 1;
                self.steps[step_index + 1].status = StepStatus::Running;
            }
        }
    }

    pub fn request_hitl(&mut self, step_index: usize, details: String) {
        if step_index < self.steps.len() {
            self.steps[step_index].status = StepStatus::WaitingHitl;
            self.steps[step_index].details = Some(details);
        }
    }
}
