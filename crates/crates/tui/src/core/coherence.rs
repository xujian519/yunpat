//! Plain-language session coherence state derived from capacity events.
//!
//! Core types have been migrated to `yunpat_protocol`.

pub use yunpat_protocol::{
    CoherenceSignal, CoherenceState, GuardrailAction, RiskBand, next_coherence_state,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn synthetic_capacity_event_log_drives_plain_language_ladder() {
        let log = [
            CoherenceSignal::CapacityDecision {
                risk_band: RiskBand::Low,
                action: GuardrailAction::NoIntervention,
                cooldown_blocked: false,
            },
            CoherenceSignal::CapacityDecision {
                risk_band: RiskBand::Medium,
                action: GuardrailAction::NoIntervention,
                cooldown_blocked: false,
            },
            CoherenceSignal::CapacityDecision {
                risk_band: RiskBand::Medium,
                action: GuardrailAction::TargetedContextRefresh,
                cooldown_blocked: false,
            },
            CoherenceSignal::CompactionCompleted,
            CoherenceSignal::CapacityDecision {
                risk_band: RiskBand::High,
                action: GuardrailAction::VerifyWithToolReplay,
                cooldown_blocked: false,
            },
            CoherenceSignal::CapacityDecision {
                risk_band: RiskBand::High,
                action: GuardrailAction::VerifyAndReplan,
                cooldown_blocked: false,
            },
        ];

        let mut state = CoherenceState::Healthy;
        let mut states = Vec::new();
        for signal in log {
            state = next_coherence_state(state, signal);
            states.push(state);
        }

        assert_eq!(
            states,
            vec![
                CoherenceState::Healthy,
                CoherenceState::GettingCrowded,
                CoherenceState::RefreshingContext,
                CoherenceState::Healthy,
                CoherenceState::VerifyingRecentWork,
                CoherenceState::ResettingPlan,
            ]
        );
    }
}
