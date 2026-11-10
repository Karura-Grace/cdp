export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      action: {
        Row: {
          action_id: string
          assessment_id: string
          baseline_value: string | null
          budget_amount: number | null
          client_decision: string | null
          client_horizon: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          effort: number
          end_date: string
          engine_ref: string
          generated_by: string
          horizon: string
          impact: string
          intervention: string
          is_visible_signal: boolean
          kpi: string | null
          level: string
          objective: string
          orientation: string
          owner: string | null
          priority_id: string
          priority_score: string
          review_points: string[]
          score_version: number
          scorecard_kpi_id: string | null
          sponsor: string | null
          start_date: string
          status: string
          system_lever: string | null
          target_value: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
          urgency: number
        }
        Insert: {
          action_id?: string
          assessment_id: string
          baseline_value?: string | null
          budget_amount?: number | null
          client_decision?: string | null
          client_horizon?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          effort: number
          end_date: string
          engine_ref: string
          generated_by: string
          horizon: string
          impact: string
          intervention: string
          is_visible_signal?: boolean
          kpi?: string | null
          level: string
          objective: string
          orientation: string
          owner?: string | null
          priority_id: string
          priority_score: string
          review_points?: string[]
          score_version: number
          scorecard_kpi_id?: string | null
          sponsor?: string | null
          start_date: string
          status?: string
          system_lever?: string | null
          target_value?: string | null
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          urgency: number
        }
        Update: {
          action_id?: string
          assessment_id?: string
          baseline_value?: string | null
          budget_amount?: number | null
          client_decision?: string | null
          client_horizon?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          effort?: number
          end_date?: string
          engine_ref?: string
          generated_by?: string
          horizon?: string
          impact?: string
          intervention?: string
          is_visible_signal?: boolean
          kpi?: string | null
          level?: string
          objective?: string
          orientation?: string
          owner?: string | null
          priority_id?: string
          priority_score?: string
          review_points?: string[]
          score_version?: number
          scorecard_kpi_id?: string | null
          sponsor?: string | null
          start_date?: string
          status?: string
          system_lever?: string | null
          target_value?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "action_assessment_id_score_version_priority_id_fkey"
            columns: ["assessment_id", "score_version", "priority_id"]
            isOneToOne: false
            referencedRelation: "priority"
            referencedColumns: ["assessment_id", "score_version", "priority_id"]
          },
          {
            foreignKeyName: "action_scorecard_kpi_id_fkey"
            columns: ["scorecard_kpi_id"]
            isOneToOne: false
            referencedRelation: "scorecard_kpi"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "action_unit_id_tenant_id_fkey"
            columns: ["unit_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "org_unit"
            referencedColumns: ["unit_id", "tenant_id"]
          },
        ]
      }
      action_event: {
        Row: {
          action_id: string
          actor_id: string | null
          at: string
          event_id: string
          from_status: string | null
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          action_id: string
          actor_id?: string | null
          at?: string
          event_id?: string
          from_status?: string | null
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          action_id?: string
          actor_id?: string | null
          at?: string
          event_id?: string
          from_status?: string | null
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_event_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action"
            referencedColumns: ["action_id"]
          },
        ]
      }
      action_evidence: {
        Row: {
          action_id: string
          content_type: string | null
          created_at: string
          created_by: string | null
          description: string
          evidence_id: string
          file_key: string | null
          file_name: string | null
          file_size: number | null
          kind: string
          link: string | null
          tenant_id: string
        }
        Insert: {
          action_id: string
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          evidence_id?: string
          file_key?: string | null
          file_name?: string | null
          file_size?: number | null
          kind: string
          link?: string | null
          tenant_id: string
        }
        Update: {
          action_id?: string
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          evidence_id?: string
          file_key?: string | null
          file_name?: string | null
          file_size?: number | null
          kind?: string
          link?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_evidence_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action"
            referencedColumns: ["action_id"]
          },
        ]
      }
      action_review: {
        Row: {
          action_id: string
          assessment_id: string
          decided_at: string
          decided_by: string | null
          engagement_id: string
          engine_decision: string
          final_decision: string
          inputs_json: Json
          override_reason: string | null
          review_id: string
          review_point: string
          score_version: number
          tenant_id: string
        }
        Insert: {
          action_id: string
          assessment_id: string
          decided_at?: string
          decided_by?: string | null
          engagement_id: string
          engine_decision: string
          final_decision: string
          inputs_json: Json
          override_reason?: string | null
          review_id?: string
          review_point: string
          score_version: number
          tenant_id: string
        }
        Update: {
          action_id?: string
          assessment_id?: string
          decided_at?: string
          decided_by?: string | null
          engagement_id?: string
          engine_decision?: string
          final_decision?: string
          inputs_json?: Json
          override_reason?: string | null
          review_id?: string
          review_point?: string
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_review_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "action_review_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      advice_item: {
        Row: {
          actions: Json
          created_at: string
          created_by: string | null
          diagnosis: string
          good: string[]
          item_id: string
          level: string
          priority: number
          questions: string[]
          risks: string[]
          rule: Json
          section: string
          signal: string
          status: string
          tags: Json
          title: string
          topic: string
          traps: string[]
          updated_at: string
          updated_by: string | null
          version_id: string
          watch: string[]
          why: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          good?: string[]
          item_id?: string
          level: string
          priority?: number
          questions?: string[]
          risks?: string[]
          rule: Json
          section: string
          signal?: string
          status?: string
          tags?: Json
          title: string
          topic: string
          traps?: string[]
          updated_at?: string
          updated_by?: string | null
          version_id: string
          watch?: string[]
          why?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          good?: string[]
          item_id?: string
          level?: string
          priority?: number
          questions?: string[]
          risks?: string[]
          rule?: Json
          section?: string
          signal?: string
          status?: string
          tags?: Json
          title?: string
          topic?: string
          traps?: string[]
          updated_at?: string
          updated_by?: string | null
          version_id?: string
          watch?: string[]
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "advice_item_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "advice_library_version"
            referencedColumns: ["version_id"]
          },
        ]
      }
      advice_library_version: {
        Row: {
          created_at: string
          created_by: string | null
          label: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          label: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          label?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          chapter: string
          cost_usd: number
          created_at: string
          created_by: string | null
          effort: string | null
          input_tokens: number
          model: string
          output_tokens: number
          report_id: string
          tenant_id: string
          usage_id: string
        }
        Insert: {
          chapter: string
          cost_usd: number
          created_at?: string
          created_by?: string | null
          effort?: string | null
          input_tokens: number
          model: string
          output_tokens: number
          report_id: string
          tenant_id: string
          usage_id?: string
        }
        Update: {
          chapter?: string
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          effort?: string | null
          input_tokens?: number
          model?: string
          output_tokens?: number
          report_id?: string
          tenant_id?: string
          usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report"
            referencedColumns: ["report_id"]
          },
        ]
      }
      assessment: {
        Row: {
          advice_version_id: string | null
          assessment_id: string
          completion_estimate_text: string | null
          consent_text_id: string | null
          created_at: string
          created_by: string | null
          engagement_id: string
          freeze_manifest: Json | null
          frozen_at: string | null
          instrument_version_id: string
          response_set_hash: string | null
          rules_version_id: string
          staff_message_text: string | null
          status: string
          supersedes_assessment_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version_reason: string | null
          window_close: string | null
          window_open: string | null
        }
        Insert: {
          advice_version_id?: string | null
          assessment_id?: string
          completion_estimate_text?: string | null
          consent_text_id?: string | null
          created_at?: string
          created_by?: string | null
          engagement_id: string
          freeze_manifest?: Json | null
          frozen_at?: string | null
          instrument_version_id: string
          response_set_hash?: string | null
          rules_version_id: string
          staff_message_text?: string | null
          status?: string
          supersedes_assessment_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version_reason?: string | null
          window_close?: string | null
          window_open?: string | null
        }
        Update: {
          advice_version_id?: string | null
          assessment_id?: string
          completion_estimate_text?: string | null
          consent_text_id?: string | null
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          freeze_manifest?: Json | null
          frozen_at?: string | null
          instrument_version_id?: string
          response_set_hash?: string | null
          rules_version_id?: string
          staff_message_text?: string | null
          status?: string
          supersedes_assessment_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_reason?: string | null
          window_close?: string | null
          window_open?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_advice_version_id_fkey"
            columns: ["advice_version_id"]
            isOneToOne: false
            referencedRelation: "advice_library_version"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "assessment_consent_text_id_tenant_id_fkey"
            columns: ["consent_text_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "consent_text"
            referencedColumns: ["consent_text_id", "tenant_id"]
          },
          {
            foreignKeyName: "assessment_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
          {
            foreignKeyName: "assessment_instrument_version_id_fkey"
            columns: ["instrument_version_id"]
            isOneToOne: false
            referencedRelation: "instrument_version"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "assessment_rules_version_id_fkey"
            columns: ["rules_version_id"]
            isOneToOne: false
            referencedRelation: "rules_version"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "assessment_supersedes_assessment_id_fkey"
            columns: ["supersedes_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          log_id: string
          object_id: string
          object_type: string
          payload_hash: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          log_id?: string
          object_id: string
          object_type: string
          payload_hash?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          log_id?: string
          object_id?: string
          object_type?: string
          payload_hash?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      breach_incident: {
        Row: {
          incident_id: string
          notified_at: string | null
          notify_by: string
          opened_at: string
          opened_by: string | null
          regulator_ref: string | null
          summary: string
          tenant_id: string | null
        }
        Insert: {
          incident_id?: string
          notified_at?: string | null
          notify_by: string
          opened_at?: string
          opened_by?: string | null
          regulator_ref?: string | null
          summary: string
          tenant_id?: string | null
        }
        Update: {
          incident_id?: string
          notified_at?: string | null
          notify_by?: string
          opened_at?: string
          opened_by?: string | null
          regulator_ref?: string | null
          summary?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breach_incident_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      carried_action: {
        Row: {
          carried_id: string
          created_at: string
          disposition: string
          new_engagement_id: string
          rollover_id: string
          snapshot_json: Json
          source_action_id: string
          status_at_carry: string
          tenant_id: string
        }
        Insert: {
          carried_id?: string
          created_at?: string
          disposition?: string
          new_engagement_id: string
          rollover_id: string
          snapshot_json: Json
          source_action_id: string
          status_at_carry: string
          tenant_id: string
        }
        Update: {
          carried_id?: string
          created_at?: string
          disposition?: string
          new_engagement_id?: string
          rollover_id?: string
          snapshot_json?: Json
          source_action_id?: string
          status_at_carry?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carried_action_new_engagement_id_fkey"
            columns: ["new_engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "carried_action_rollover_id_fkey"
            columns: ["rollover_id"]
            isOneToOne: false
            referencedRelation: "rollover"
            referencedColumns: ["rollover_id"]
          },
          {
            foreignKeyName: "carried_action_source_action_id_fkey"
            columns: ["source_action_id"]
            isOneToOne: false
            referencedRelation: "action"
            referencedColumns: ["action_id"]
          },
        ]
      }
      coach_assignment: {
        Row: {
          coach_assignment_id: string
          coach_user_id: string
          created_at: string
          created_by: string | null
          from_date: string
          leader_person_ids: string[]
          tenant_id: string
          to_date: string
        }
        Insert: {
          coach_assignment_id?: string
          coach_user_id: string
          created_at?: string
          created_by?: string | null
          from_date: string
          leader_person_ids: string[]
          tenant_id: string
          to_date: string
        }
        Update: {
          coach_assignment_id?: string
          coach_user_id?: string
          created_at?: string
          created_by?: string | null
          from_date?: string
          leader_person_ids?: string[]
          tenant_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      comparison: {
        Row: {
          baseline_assessment_id: string
          baseline_score_version: number
          comparison_id: string
          created_at: string
          created_by: string | null
          current_assessment_id: string
          current_score_version: number
          deltas_hash: string
          deltas_json: Json
          engagement_id: string
          tenant_id: string
          version_relation: string
        }
        Insert: {
          baseline_assessment_id: string
          baseline_score_version: number
          comparison_id?: string
          created_at?: string
          created_by?: string | null
          current_assessment_id: string
          current_score_version: number
          deltas_hash: string
          deltas_json: Json
          engagement_id: string
          tenant_id: string
          version_relation: string
        }
        Update: {
          baseline_assessment_id?: string
          baseline_score_version?: number
          comparison_id?: string
          created_at?: string
          created_by?: string | null
          current_assessment_id?: string
          current_score_version?: number
          deltas_hash?: string
          deltas_json?: Json
          engagement_id?: string
          tenant_id?: string
          version_relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_baseline_assessment_id_fkey"
            columns: ["baseline_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "comparison_current_assessment_id_fkey"
            columns: ["current_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "comparison_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      consent_text: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          consent_text_id: string
          created_at: string
          created_by: string | null
          locale: string
          privacy_regime: string
          status: string
          tenant_id: string
          title: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          consent_text_id?: string
          created_at?: string
          created_by?: string | null
          locale?: string
          privacy_regime: string
          status?: string
          tenant_id: string
          title: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          consent_text_id?: string
          created_at?: string
          created_by?: string | null
          locale?: string
          privacy_regime?: string
          status?: string
          tenant_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_text_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      consultant_task: {
        Row: {
          created_at: string
          detail: string | null
          done_at: string | null
          done_by: string | null
          kind: string
          source_ref: string | null
          status: string
          task_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          done_at?: string | null
          done_by?: string | null
          kind: string
          source_ref?: string | null
          status?: string
          task_id?: string
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          done_at?: string | null
          done_by?: string | null
          kind?: string
          source_ref?: string | null
          status?: string
          task_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_task_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      data_subject_request: {
        Row: {
          closed_at: string | null
          closed_note: string | null
          detail: string | null
          due_on: string | null
          kind: string
          opened_at: string
          request_id: string
          status: string
          subject_ref: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_note?: string | null
          detail?: string | null
          due_on?: string | null
          kind: string
          opened_at?: string
          request_id?: string
          status?: string
          subject_ref: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          closed_note?: string | null
          detail?: string | null
          due_on?: string | null
          kind?: string
          opened_at?: string
          request_id?: string
          status?: string
          subject_ref?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      demographic_attribute: {
        Row: {
          analytical_purpose: string
          attr_id: string
          created_at: string
          created_by: string | null
          is_sensitive: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          values_list: string[]
        }
        Insert: {
          analytical_purpose: string
          attr_id?: string
          created_at?: string
          created_by?: string | null
          is_sensitive?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          values_list: string[]
        }
        Update: {
          analytical_purpose?: string
          attr_id?: string
          created_at?: string
          created_by?: string | null
          is_sensitive?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          values_list?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "demographic_attribute_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      destruction_certificate: {
        Row: {
          cert_hash: string
          cert_id: string
          destroyed_at: string
          engagement_id: string
          row_counts: Json
          tenant_id: string
        }
        Insert: {
          cert_hash: string
          cert_id?: string
          destroyed_at?: string
          engagement_id: string
          row_counts: Json
          tenant_id: string
        }
        Update: {
          cert_hash?: string
          cert_id?: string
          destroyed_at?: string
          engagement_id?: string
          row_counts?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destruction_certificate_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
        ]
      }
      development_item: {
        Row: {
          agreed_at: string | null
          agreed_by: string | null
          assessment_id: string
          assignment_id: string
          basis: string
          behaviour: string | null
          created_at: string
          created_by: string | null
          item_id: string
          orientation: string | null
          score_version: number
          section: string | null
          seq: number
          start_stop_keep: string | null
          support: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          visible_change_30d: string | null
        }
        Insert: {
          agreed_at?: string | null
          agreed_by?: string | null
          assessment_id: string
          assignment_id: string
          basis: string
          behaviour?: string | null
          created_at?: string
          created_by?: string | null
          item_id?: string
          orientation?: string | null
          score_version: number
          section?: string | null
          seq: number
          start_stop_keep?: string | null
          support: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          visible_change_30d?: string | null
        }
        Update: {
          agreed_at?: string | null
          agreed_by?: string | null
          assessment_id?: string
          assignment_id?: string
          basis?: string
          behaviour?: string | null
          created_at?: string
          created_by?: string | null
          item_id?: string
          orientation?: string | null
          score_version?: number
          section?: string | null
          seq?: number
          start_stop_keep?: string | null
          support?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          visible_change_30d?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_item_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
          {
            foreignKeyName: "development_item_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "leader_assignment"
            referencedColumns: ["assignment_id"]
          },
        ]
      }
      dpia_record: {
        Row: {
          dpia_id: string
          recorded_at: string
          recorded_by: string | null
          reference: string
          tenant_id: string
          transfer_basis: string
        }
        Insert: {
          dpia_id?: string
          recorded_at?: string
          recorded_by?: string | null
          reference: string
          tenant_id: string
          transfer_basis: string
        }
        Update: {
          dpia_id?: string
          recorded_at?: string
          recorded_by?: string | null
          reference?: string
          tenant_id?: string
          transfer_basis?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpia_record_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      engagement: {
        Row: {
          contradiction_flags: Json | null
          created_at: string
          created_by: string | null
          cycle_no: number
          engagement_id: string
          g5_system: Json | null
          launch_approved_at: string | null
          launch_approved_by: string | null
          previous_engagement_id: string | null
          purpose: string | null
          setup_snapshot: Json | null
          setup_version: number
          state: Database["public"]["Enums"]["engagement_state"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contradiction_flags?: Json | null
          created_at?: string
          created_by?: string | null
          cycle_no: number
          engagement_id?: string
          g5_system?: Json | null
          launch_approved_at?: string | null
          launch_approved_by?: string | null
          previous_engagement_id?: string | null
          purpose?: string | null
          setup_snapshot?: Json | null
          setup_version?: number
          state?: Database["public"]["Enums"]["engagement_state"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contradiction_flags?: Json | null
          created_at?: string
          created_by?: string | null
          cycle_no?: number
          engagement_id?: string
          g5_system?: Json | null
          launch_approved_at?: string | null
          launch_approved_by?: string | null
          previous_engagement_id?: string | null
          purpose?: string | null
          setup_snapshot?: Json | null
          setup_version?: number
          state?: Database["public"]["Enums"]["engagement_state"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_previous_engagement_id_fkey"
            columns: ["previous_engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      evaluation: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          payload_hash: string
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          payload_hash: string
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          payload_hash?: string
          payload_json?: Json
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: true
            referencedRelation: "score_object"
            referencedColumns: ["assessment_id", "version"]
          },
          {
            foreignKeyName: "evaluation_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      exclusion_log: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string
          exclusion_id: string
          kind: string
          reason: string
          response_id: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by: string
          exclusion_id?: string
          kind: string
          reason: string
          response_id: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string
          exclusion_id?: string
          kind?: string
          reason?: string
          response_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusion_log_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "exclusion_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      finding_annotation: {
        Row: {
          annotation_id: string
          assessment_id: string
          body: string
          created_at: string
          created_by: string | null
          finding_id: string
          score_version: number
          tenant_id: string
        }
        Insert: {
          annotation_id?: string
          assessment_id: string
          body: string
          created_at?: string
          created_by?: string | null
          finding_id: string
          score_version: number
          tenant_id: string
        }
        Update: {
          annotation_id?: string
          assessment_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          finding_id?: string
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finding_annotation_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: false
            referencedRelation: "evaluation"
            referencedColumns: ["assessment_id", "score_version"]
          },
          {
            foreignKeyName: "finding_annotation_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      grade_band: {
        Row: {
          created_at: string
          created_by: string | null
          grade_id: string
          is_executive: boolean
          name: string
          rank_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grade_id?: string
          is_executive?: boolean
          name: string
          rank_order: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grade_id?: string
          is_executive?: boolean
          name?: string
          rank_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_band_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      instrument_version: {
        Row: {
          created_at: string
          created_by: string | null
          equivalence_note: string | null
          published_at: string | null
          semver: string
          status: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equivalence_note?: string | null
          published_at?: string | null
          semver: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equivalence_note?: string | null
          published_at?: string | null
          semver?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      invitation_roster: {
        Row: {
          assessment_id: string
          invited_at: string
          person_id: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          invited_at?: string
          person_id: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          invited_at?: string
          person_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_roster_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      item: {
        Row: {
          block: string
          canonical_text: string
          dimension: string | null
          item_id: string
          scale_type: string
          sequence: number
          title: string | null
          version_id: string
        }
        Insert: {
          block: string
          canonical_text: string
          dimension?: string | null
          item_id: string
          scale_type: string
          sequence: number
          title?: string | null
          version_id: string
        }
        Update: {
          block?: string
          canonical_text?: string
          dimension?: string | null
          item_id?: string
          scale_type?: string
          sequence?: number
          title?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "instrument_version"
            referencedColumns: ["version_id"]
          },
        ]
      }
      kpi_reading: {
        Row: {
          action_id: string
          created_at: string
          created_by: string | null
          note: string | null
          read_on: string
          reading_id: string
          tenant_id: string
          value: string
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          read_on: string
          reading_id?: string
          tenant_id: string
          value: string
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          read_on?: string
          reading_id?: string
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_reading_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action"
            referencedColumns: ["action_id"]
          },
        ]
      }
      leader_assignment: {
        Row: {
          assignment_id: string
          created_at: string
          created_by: string | null
          effect_from: string
          effect_to: string | null
          person_id: string
          team_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          effect_from: string
          effect_to?: string | null
          person_id: string
          team_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          effect_from?: string
          effect_to?: string | null
          person_id?: string
          team_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leader_assignment_person_id_tenant_id_fkey"
            columns: ["person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "person_of_record"
            referencedColumns: ["person_id", "tenant_id"]
          },
          {
            foreignKeyName: "leader_assignment_team_id_tenant_id_fkey"
            columns: ["team_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "org_unit"
            referencedColumns: ["unit_id", "tenant_id"]
          },
          {
            foreignKeyName: "leader_assignment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      leader_link_result: {
        Row: {
          assessment_id: string
          assignment_id: string
          created_at: string
          created_by: string | null
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          assignment_id: string
          created_at?: string
          created_by?: string | null
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          payload_json?: Json
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_link_result_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      leader_result: {
        Row: {
          assessment_id: string
          assignment_id: string
          created_at: string
          created_by: string | null
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          assignment_id: string
          created_at?: string
          created_by?: string | null
          payload_json: Json
          score_version: number
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          payload_json?: Json
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_result_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      location: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          location_id: string
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          location_id?: string
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          location_id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      objective: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_id: string
          external_ref: string | null
          objective_id: string
          priority_keys: string[]
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_id: string
          external_ref?: string | null
          objective_id?: string
          priority_keys?: string[]
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          external_ref?: string | null
          objective_id?: string
          priority_keys?: string[]
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objective_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
        ]
      }
      org_change: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          effective_date: string
          engagement_id: string
          org_change_id: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          effective_date: string
          engagement_id: string
          org_change_id?: string
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          effective_date?: string
          engagement_id?: string
          org_change_id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_change_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      org_graph_snapshot: {
        Row: {
          defects_json: Json
          engagement_id: string
          graph_version: number
          overrides_json: Json
          scope_json: Json
          taken_at: string
          taken_by: string
          tenant_id: string
          window_start: string
        }
        Insert: {
          defects_json: Json
          engagement_id: string
          graph_version: number
          overrides_json: Json
          scope_json: Json
          taken_at?: string
          taken_by: string
          tenant_id: string
          window_start: string
        }
        Update: {
          defects_json?: Json
          engagement_id?: string
          graph_version?: number
          overrides_json?: Json
          scope_json?: Json
          taken_at?: string
          taken_by?: string
          tenant_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_graph_snapshot_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "org_graph_snapshot_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      org_override: {
        Row: {
          engagement_id: string
          reason: string
          rule: string
          set_at: string
          set_by: string
          tenant_id: string
        }
        Insert: {
          engagement_id: string
          reason: string
          rule: string
          set_at?: string
          set_by: string
          tenant_id: string
        }
        Update: {
          engagement_id?: string
          reason?: string
          rule?: string
          set_at?: string
          set_by?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_override_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "org_override_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      org_unit: {
        Row: {
          created_at: string
          created_by: string | null
          name: string
          parent_unit_id: string | null
          rollup_to_parent: boolean
          tenant_id: string
          type: string
          unit_id: string
          unit_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          name: string
          parent_unit_id?: string | null
          rollup_to_parent?: boolean
          tenant_id: string
          type: string
          unit_id?: string
          unit_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          name?: string
          parent_unit_id?: string | null
          rollup_to_parent?: boolean
          tenant_id?: string
          type?: string
          unit_id?: string
          unit_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_unit_parent_unit_id_tenant_id_fkey"
            columns: ["parent_unit_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "org_unit"
            referencedColumns: ["unit_id", "tenant_id"]
          },
          {
            foreignKeyName: "org_unit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      person_demographic: {
        Row: {
          attr_id: string
          person_id: string
          tenant_id: string
          value: string
        }
        Insert: {
          attr_id: string
          person_id: string
          tenant_id: string
          value: string
        }
        Update: {
          attr_id?: string
          person_id?: string
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_demographic_attr_id_tenant_id_fkey"
            columns: ["attr_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "demographic_attribute"
            referencedColumns: ["attr_id", "tenant_id"]
          },
          {
            foreignKeyName: "person_demographic_person_id_tenant_id_fkey"
            columns: ["person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "person_of_record"
            referencedColumns: ["person_id", "tenant_id"]
          },
        ]
      }
      person_of_record: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          employee_ref: string
          employment_status: string
          grade_id: string | null
          location_id: string | null
          person_id: string
          role_tag: string | null
          start_date: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          employee_ref: string
          employment_status: string
          grade_id?: string | null
          location_id?: string | null
          person_id?: string
          role_tag?: string | null
          start_date?: string | null
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          employee_ref?: string
          employment_status?: string
          grade_id?: string | null
          location_id?: string | null
          person_id?: string
          role_tag?: string | null
          start_date?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_of_record_grade_id_tenant_id_fkey"
            columns: ["grade_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "grade_band"
            referencedColumns: ["grade_id", "tenant_id"]
          },
          {
            foreignKeyName: "person_of_record_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id", "tenant_id"]
          },
          {
            foreignKeyName: "person_of_record_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "person_of_record_unit_id_tenant_id_fkey"
            columns: ["unit_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "org_unit"
            referencedColumns: ["unit_id", "tenant_id"]
          },
        ]
      }
      plan: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          payload_hash: string
          payload_json: Json
          score_version: number
          start_date: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          payload_hash: string
          payload_json: Json
          score_version: number
          start_date: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          payload_hash?: string
          payload_json?: Json
          score_version?: number
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: true
            referencedRelation: "evaluation"
            referencedColumns: ["assessment_id", "score_version"]
          },
          {
            foreignKeyName: "plan_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      plan_client_order: {
        Row: {
          assessment_id: string
          order_id: string
          ranking: string[]
          score_version: number
          set_at: string
          set_by: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          order_id?: string
          ranking: string[]
          score_version: number
          set_at?: string
          set_by: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          order_id?: string
          ranking?: string[]
          score_version?: number
          set_at?: string
          set_by?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_client_order_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["assessment_id", "score_version"]
          },
        ]
      }
      platform_setting: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      priority: {
        Row: {
          assessment_id: string
          blocked_by: string[]
          classification: string
          due: string
          gap: string
          linked_findings: string[]
          orientation: string
          owner_role: string
          priority_id: string
          score_version: number
          sequence: number
          tenant_id: string
          trade_off_orientation: string | null
          urgency_tier: string
        }
        Insert: {
          assessment_id: string
          blocked_by?: string[]
          classification: string
          due: string
          gap: string
          linked_findings?: string[]
          orientation: string
          owner_role: string
          priority_id: string
          score_version: number
          sequence: number
          tenant_id: string
          trade_off_orientation?: string | null
          urgency_tier: string
        }
        Update: {
          assessment_id?: string
          blocked_by?: string[]
          classification?: string
          due?: string
          gap?: string
          linked_findings?: string[]
          orientation?: string
          owner_role?: string
          priority_id?: string
          score_version?: number
          sequence?: number
          tenant_id?: string
          trade_off_orientation?: string | null
          urgency_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "priority_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["assessment_id", "score_version"]
          },
        ]
      }
      priority_zero_item: {
        Row: {
          assessment_id: string
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          finding_ids: string[]
          gate: string
          item: string
          item_id: string
          score_version: number
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          finding_ids?: string[]
          gate: string
          item: string
          item_id: string
          score_version: number
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          finding_ids?: string[]
          gate?: string
          item?: string
          item_id?: string
          score_version?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "priority_zero_item_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["assessment_id", "score_version"]
          },
        ]
      }
      processing_register: {
        Row: {
          activity: string
          data_categories: string
          entry_id: string
          legal_basis: string
          purpose: string
          recorded_at: string
          recorded_by: string | null
          retention: string
          tenant_id: string | null
        }
        Insert: {
          activity: string
          data_categories: string
          entry_id?: string
          legal_basis: string
          purpose: string
          recorded_at?: string
          recorded_by?: string | null
          retention: string
          tenant_id?: string | null
        }
        Update: {
          activity?: string
          data_categories?: string
          entry_id?: string
          legal_basis?: string
          purpose?: string
          recorded_at?: string
          recorded_by?: string | null
          retention?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_register_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      pulse: {
        Row: {
          assessment_id: string
          baseline_json: Json
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          engagement_id: string
          items: string[]
          opens_at: string | null
          priority_id: string
          pulse_id: string
          review_point: string
          score_version: number
          status: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          baseline_json: Json
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          engagement_id: string
          items: string[]
          opens_at?: string | null
          priority_id: string
          pulse_id?: string
          review_point: string
          score_version: number
          status?: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          baseline_json?: Json
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          items?: string[]
          opens_at?: string | null
          priority_id?: string
          pulse_id?: string
          review_point?: string
          score_version?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_assessment_id_score_version_priority_id_fkey"
            columns: ["assessment_id", "score_version", "priority_id"]
            isOneToOne: false
            referencedRelation: "priority"
            referencedColumns: ["assessment_id", "score_version", "priority_id"]
          },
          {
            foreignKeyName: "pulse_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      pulse_result: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_id: string
          n_invited: number
          n_responded: number
          pulse_id: string
          reading_json: Json | null
          suppressed: boolean
          tenant_id: string
          triggers_json: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_id: string
          n_invited: number
          n_responded: number
          pulse_id: string
          reading_json?: Json | null
          suppressed: boolean
          tenant_id: string
          triggers_json?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          n_invited?: number
          n_responded?: number
          pulse_id?: string
          reading_json?: Json | null
          suppressed?: boolean
          tenant_id?: string
          triggers_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pulse_result_pulse_id_fkey"
            columns: ["pulse_id"]
            isOneToOne: true
            referencedRelation: "pulse"
            referencedColumns: ["pulse_id"]
          },
        ]
      }
      rater_nomination: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assessment_id: string
          assignment_id: string
          created_at: string
          created_by: string | null
          nomination_id: string
          proposed_by: string | null
          rater_group: string
          rater_person_id: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assessment_id: string
          assignment_id: string
          created_at?: string
          created_by?: string | null
          nomination_id?: string
          proposed_by?: string | null
          rater_group: string
          rater_person_id: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          nomination_id?: string
          proposed_by?: string | null
          rater_group?: string
          rater_person_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rater_nomination_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
          {
            foreignKeyName: "rater_nomination_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "leader_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "rater_nomination_rater_person_id_tenant_id_fkey"
            columns: ["rater_person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "person_of_record"
            referencedColumns: ["person_id", "tenant_id"]
          },
          {
            foreignKeyName: "rater_nomination_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      rater_window: {
        Row: {
          assessment_id: string
          assignment_id: string
          closes_on: string
          created_at: string
          created_by: string | null
          opens_on: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_id: string
          assignment_id: string
          closes_on: string
          created_at?: string
          created_by?: string | null
          opens_on: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_id?: string
          assignment_id?: string
          closes_on?: string
          created_at?: string
          created_by?: string | null
          opens_on?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rater_window_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "rater_window_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "leader_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "rater_window_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      reassessment_trigger: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          engagement_id: string
          raised_at: string
          raised_by: string | null
          reason: string | null
          source_ref: string
          tenant_id: string
          trigger_id: string
          type: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          engagement_id: string
          raised_at?: string
          raised_by?: string | null
          reason?: string | null
          source_ref: string
          tenant_id: string
          trigger_id?: string
          type: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          engagement_id?: string
          raised_at?: string
          raised_by?: string | null
          reason?: string | null
          source_ref?: string
          tenant_id?: string
          trigger_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reassessment_trigger_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      report: {
        Row: {
          accepted_json: Json
          assessment_id: string
          audience: string | null
          created_at: string
          created_by: string | null
          files: Json
          payload_hash: string | null
          released_at: string | null
          released_by: string | null
          report_id: string
          score_version: number
          sections_json: Json
          status: string
          tenant_id: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_json?: Json
          assessment_id: string
          audience?: string | null
          created_at?: string
          created_by?: string | null
          files?: Json
          payload_hash?: string | null
          released_at?: string | null
          released_by?: string | null
          report_id?: string
          score_version: number
          sections_json?: Json
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_json?: Json
          assessment_id?: string
          audience?: string | null
          created_at?: string
          created_by?: string | null
          files?: Json
          payload_hash?: string | null
          released_at?: string | null
          released_by?: string | null
          report_id?: string
          score_version?: number
          sections_json?: Json
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_assessment_id_score_version_fkey"
            columns: ["assessment_id", "score_version"]
            isOneToOne: false
            referencedRelation: "score_object"
            referencedColumns: ["assessment_id", "version"]
          },
          {
            foreignKeyName: "report_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      report_advice: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string
          edited: Json | null
          item_id: string
          level: string
          proposed_rank: number
          report_id: string
          scope_key: string
          section: string
          tenant_id: string
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          edited?: Json | null
          item_id: string
          level: string
          proposed_rank: number
          report_id: string
          scope_key?: string
          section: string
          tenant_id: string
          version_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          edited?: Json | null
          item_id?: string
          level?: string
          proposed_rank?: number
          report_id?: string
          scope_key?: string
          section?: string
          tenant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_advice_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "advice_item"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "report_advice_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "report_advice_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "advice_library_version"
            referencedColumns: ["version_id"]
          },
        ]
      }
      retention_schedule: {
        Row: {
          assessment_id: string
          close_date: string
          destroy_on: string
          destroyed_at: string | null
          engagement_id: string
          notice_30_on: string
          notice_30_sent_at: string | null
          notice_90_on: string
          notice_90_sent_at: string | null
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          close_date: string
          destroy_on: string
          destroyed_at?: string | null
          engagement_id: string
          notice_30_on: string
          notice_30_sent_at?: string | null
          notice_90_on: string
          notice_90_sent_at?: string | null
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          close_date?: string
          destroy_on?: string
          destroyed_at?: string | null
          engagement_id?: string
          notice_30_on?: string
          notice_30_sent_at?: string | null
          notice_90_on?: string
          notice_90_sent_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_schedule_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
          {
            foreignKeyName: "retention_schedule_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
        ]
      }
      rollover: {
        Row: {
          actions_carried: number
          carry_json: Json
          created_at: string
          created_by: string | null
          new_engagement_id: string
          previous_engagement_id: string
          rollover_id: string
          setup_sections: number
          tenant_id: string
        }
        Insert: {
          actions_carried: number
          carry_json: Json
          created_at?: string
          created_by?: string | null
          new_engagement_id: string
          previous_engagement_id: string
          rollover_id?: string
          setup_sections: number
          tenant_id: string
        }
        Update: {
          actions_carried?: number
          carry_json?: Json
          created_at?: string
          created_by?: string | null
          new_engagement_id?: string
          previous_engagement_id?: string
          rollover_id?: string
          setup_sections?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rollover_new_engagement_id_fkey"
            columns: ["new_engagement_id"]
            isOneToOne: true
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "rollover_previous_engagement_id_fkey"
            columns: ["previous_engagement_id"]
            isOneToOne: true
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      rules_version: {
        Row: {
          created_at: string
          created_by: string | null
          equivalence_note: string | null
          published_at: string | null
          semver: string
          status: string
          updated_at: string
          updated_by: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equivalence_note?: string | null
          published_at?: string | null
          semver: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equivalence_note?: string | null
          published_at?: string | null
          semver?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      scenario: {
        Row: {
          dimension: string
          prompt_now: string
          prompt_preferred: string
          scenario_id: string
          sequence: number
          title: string
          version_id: string
        }
        Insert: {
          dimension: string
          prompt_now: string
          prompt_preferred: string
          scenario_id: string
          sequence: number
          title: string
          version_id: string
        }
        Update: {
          dimension?: string
          prompt_now?: string
          prompt_preferred?: string
          scenario_id?: string
          sequence?: number
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "instrument_version"
            referencedColumns: ["version_id"]
          },
        ]
      }
      scenario_statement: {
        Row: {
          orientation: string
          scenario_id: string
          text: string
          version_id: string
        }
        Insert: {
          orientation: string
          scenario_id: string
          text: string
          version_id: string
        }
        Update: {
          orientation?: string
          scenario_id?: string
          text?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_statement_version_id_scenario_id_fkey"
            columns: ["version_id", "scenario_id"]
            isOneToOne: false
            referencedRelation: "scenario"
            referencedColumns: ["version_id", "scenario_id"]
          },
        ]
      }
      score_object: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          frozen_at: string | null
          frozen_by: string | null
          payload_hash: string
          payload_json: Json
          score_id: string
          tenant_id: string
          version: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          payload_hash: string
          payload_json: Json
          score_id?: string
          tenant_id: string
          version: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          payload_hash?: string
          payload_json?: Json
          score_id?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_object_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      scorecard_kpi: {
        Row: {
          baseline_date: string
          baseline_source: string
          baseline_value: number
          created_at: string
          created_by: string | null
          currency_code: string | null
          direction: string
          engagement_id: string
          external_ref: string | null
          kpi_id: string
          name: string
          objective_id: string
          orientation: string | null
          target_12m: number
          target_3y: number | null
          tenant_id: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          baseline_date: string
          baseline_source: string
          baseline_value: number
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          direction: string
          engagement_id: string
          external_ref?: string | null
          kpi_id?: string
          name: string
          objective_id: string
          orientation?: string | null
          target_12m: number
          target_3y?: number | null
          tenant_id: string
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          baseline_date?: string
          baseline_source?: string
          baseline_value?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          direction?: string
          engagement_id?: string
          external_ref?: string | null
          kpi_id?: string
          name?: string
          objective_id?: string
          orientation?: string | null
          target_12m?: number
          target_3y?: number | null
          tenant_id?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_kpi_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
          {
            foreignKeyName: "scorecard_kpi_objective_id_tenant_id_fkey"
            columns: ["objective_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "objective"
            referencedColumns: ["objective_id", "tenant_id"]
          },
        ]
      }
      scorecard_kpi_reading: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_id: string
          kpi_id: string
          note: string | null
          read_on: string
          reading_id: string
          tenant_id: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_id: string
          kpi_id: string
          note?: string | null
          read_on: string
          reading_id?: string
          tenant_id: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          kpi_id?: string
          note?: string | null
          read_on?: string
          reading_id?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_kpi_reading_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
          {
            foreignKeyName: "scorecard_kpi_reading_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "scorecard_kpi"
            referencedColumns: ["kpi_id"]
          },
        ]
      }
      segment_profile: {
        Row: {
          assessment_id: string
          axis: string
          created_at: string
          created_by: string | null
          n: number
          payload_hash: string
          profile_json: Json
          score_version: number
          segment_key: string
          tenant_id: string
          value: string
        }
        Insert: {
          assessment_id: string
          axis: string
          created_at?: string
          created_by?: string | null
          n: number
          payload_hash: string
          profile_json: Json
          score_version: number
          segment_key: string
          tenant_id: string
          value: string
        }
        Update: {
          assessment_id?: string
          axis?: string
          created_at?: string
          created_by?: string | null
          n?: number
          payload_hash?: string
          profile_json?: Json
          score_version?: number
          segment_key?: string
          tenant_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_profile_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
        ]
      }
      segment_query_log: {
        Row: {
          actor_id: string | null
          assessment_id: string
          at: string
          axis: string
          outcome: string
          predicates: Json
          query_id: string
          resolved_count: number | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          assessment_id: string
          at?: string
          axis: string
          outcome: string
          predicates?: Json
          query_id?: string
          resolved_count?: number | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          assessment_id?: string
          at?: string
          axis?: string
          outcome?: string
          predicates?: Json
          query_id?: string
          resolved_count?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_query_log_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
          {
            foreignKeyName: "segment_query_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      setup_confirmation: {
        Row: {
          confirmed_at: string
          engagement_id: string
          section: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          engagement_id: string
          section: string
          tenant_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          engagement_id?: string
          section?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_confirmation_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
        ]
      }
      setup_record: {
        Row: {
          created_at: string
          created_by: string | null
          divergence_flags: Json
          engagement_id: string
          facilitator: string | null
          facilitator_user_id: string | null
          locked_at: string | null
          participants: string[]
          payload_json: Json
          perspective: string
          section: string
          setup_id: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          workshop_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          divergence_flags?: Json
          engagement_id: string
          facilitator?: string | null
          facilitator_user_id?: string | null
          locked_at?: string | null
          participants?: string[]
          payload_json?: Json
          perspective: string
          section: string
          setup_id?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          workshop_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          divergence_flags?: Json
          engagement_id?: string
          facilitator?: string | null
          facilitator_user_id?: string | null
          locked_at?: string | null
          participants?: string[]
          payload_json?: Json
          perspective?: string
          section?: string
          setup_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          workshop_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setup_record_engagement_id_tenant_id_fkey"
            columns: ["engagement_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id", "tenant_id"]
          },
        ]
      }
      setup_system_note: {
        Row: {
          assessment_id: string
          body: string
          created_at: string
          engagement_id: string
          item: string
          note_id: string
          score_version: number
          section: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          body: string
          created_at?: string
          engagement_id: string
          item: string
          note_id?: string
          score_version: number
          section: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          body?: string
          created_at?: string
          engagement_id?: string
          item?: string
          note_id?: string
          score_version?: number
          section?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_system_note_assessment_id_tenant_id_fkey"
            columns: ["assessment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id", "tenant_id"]
          },
          {
            foreignKeyName: "setup_system_note_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      setup_workbook_final: {
        Row: {
          engagement_id: string
          mark_id: string
          marked_at: string
          marked_by: string | null
          tenant_id: string
          version_id: string
        }
        Insert: {
          engagement_id: string
          mark_id?: string
          marked_at?: string
          marked_by?: string | null
          tenant_id: string
          version_id: string
        }
        Update: {
          engagement_id?: string
          mark_id?: string
          marked_at?: string
          marked_by?: string | null
          tenant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_workbook_final_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "setup_workbook_final_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "setup_workbook_final_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "setup_workbook_version"
            referencedColumns: ["version_id"]
          },
        ]
      }
      setup_workbook_version: {
        Row: {
          clean: boolean
          engagement_id: string
          file_hash: string
          file_name: string
          sections_json: Json
          tenant_id: string
          uploaded_at: string
          uploaded_by: string | null
          version_id: string
          version_no: number
        }
        Insert: {
          clean: boolean
          engagement_id: string
          file_hash: string
          file_name: string
          sections_json: Json
          tenant_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_id?: string
          version_no: number
        }
        Update: {
          clean?: boolean
          engagement_id?: string
          file_hash?: string
          file_name?: string
          sections_json?: Json
          tenant_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "setup_workbook_version_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "setup_workbook_version_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      sub_processor: {
        Row: {
          added_at: string
          added_by: string | null
          name: string
          processor_id: string
          purpose: string
          region: string
          transfer_basis: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          name: string
          processor_id?: string
          purpose: string
          region: string
          transfer_basis: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          name?: string
          processor_id?: string
          purpose?: string
          region?: string
          transfer_basis?: string
        }
        Relationships: []
      }
      tenant: {
        Row: {
          branding_pack_id: string | null
          cover_colour: string | null
          created_at: string
          created_by: string | null
          currency_code: string | null
          dpia_recorded_at: string | null
          geographies: string[]
          headcount: number | null
          legal_name: string | null
          logo_data: string | null
          logo_type: string | null
          name: string
          odpc_confirmed_on: string | null
          odpc_registration_ref: string | null
          org_graph_version: number
          privacy_regime: string
          residency_region: string
          review_period_end: string | null
          review_period_start: string | null
          sector: string | null
          services: string[]
          tenant_id: string
          timezone: string
          transfer_basis_recorded_at: string | null
          transfer_basis_ref: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branding_pack_id?: string | null
          cover_colour?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          dpia_recorded_at?: string | null
          geographies?: string[]
          headcount?: number | null
          legal_name?: string | null
          logo_data?: string | null
          logo_type?: string | null
          name: string
          odpc_confirmed_on?: string | null
          odpc_registration_ref?: string | null
          org_graph_version?: number
          privacy_regime: string
          residency_region?: string
          review_period_end?: string | null
          review_period_start?: string | null
          sector?: string | null
          services?: string[]
          tenant_id?: string
          timezone?: string
          transfer_basis_recorded_at?: string | null
          transfer_basis_ref?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branding_pack_id?: string | null
          cover_colour?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          dpia_recorded_at?: string | null
          geographies?: string[]
          headcount?: number | null
          legal_name?: string | null
          logo_data?: string | null
          logo_type?: string | null
          name?: string
          odpc_confirmed_on?: string | null
          odpc_registration_ref?: string | null
          org_graph_version?: number
          privacy_regime?: string
          residency_region?: string
          review_period_end?: string | null
          review_period_start?: string | null
          sector?: string | null
          services?: string[]
          tenant_id?: string
          timezone?: string
          transfer_basis_recorded_at?: string | null
          transfer_basis_ref?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tenant_holiday: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          label: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          label: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          label?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_holiday_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenure_band: {
        Row: {
          band_id: string
          created_at: string
          created_by: string | null
          max_months: number | null
          min_months: number
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          band_id?: string
          created_at?: string
          created_by?: string | null
          max_months?: number | null
          min_months: number
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          band_id?: string
          created_at?: string
          created_by?: string | null
          max_months?: number | null
          min_months?: number
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenure_band_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      window_extension: {
        Row: {
          approved_by: string | null
          assessment_id: string
          created_at: string
          new_close: string
          old_close: string
          reason: string
          requested_by: string
          seq: number
          tenant_id: string
          working_days: number
        }
        Insert: {
          approved_by?: string | null
          assessment_id: string
          created_at?: string
          new_close: string
          old_close: string
          reason: string
          requested_by: string
          seq: number
          tenant_id: string
          working_days: number
        }
        Update: {
          approved_by?: string | null
          assessment_id?: string
          created_at?: string
          new_close?: string
          old_close?: string
          reason?: string
          requested_by?: string
          seq?: number
          tenant_id?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "window_extension_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "window_extension_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rpc_action_client_fields: {
        Args: { p_action: string; p_actor: string; p_fields: Json }
        Returns: undefined
      }
      rpc_action_client_set: {
        Args: { p_action: string; p_actor: string; p_set: Json }
        Returns: undefined
      }
      rpc_action_link_kpi: {
        Args: { p_actions: string[]; p_actor: string; p_kpi: string }
        Returns: number
      }
      rpc_action_review_record: {
        Args: {
          p_action: string
          p_actor: string
          p_engine: string
          p_final: string
          p_inputs: Json
          p_point: string
          p_reason: string
        }
        Returns: string
      }
      rpc_action_transition: {
        Args: {
          p_action: string
          p_actor: string
          p_from: string
          p_reason: string
          p_to: string
        }
        Returns: undefined
      }
      rpc_action_update: {
        Args: { p_action: string; p_actor: string; p_fields: Json }
        Returns: undefined
      }
      rpc_actor_role: { Args: { p_engagement: string }; Returns: string }
      rpc_actor_scope: { Args: never; Returns: Json }
      rpc_assessment_new_version: {
        Args: { p_assessment: string; p_reason: string }
        Returns: string
      }
      rpc_assignment_add: {
        Args: {
          p_actor: string
          p_engagement: string
          p_user: string
          p_valid_to: string
        }
        Returns: string
      }
      rpc_assignment_revoke: {
        Args: { p_actor: string; p_assignment: string }
        Returns: undefined
      }
      rpc_auto_submit_drafts: {
        Args: { p_assessment_id: string }
        Returns: number
      }
      rpc_can_manage: {
        Args: { p_actor: string; p_role: string; p_tenant: string }
        Returns: boolean
      }
      rpc_claim_reminders: {
        Args: {
          p_assessment_id: string
          p_kind: string
          p_started_only: boolean
        }
        Returns: string[]
      }
      rpc_closed_pulse_set: {
        Args: { p_floor: number; p_pulse: string }
        Returns: Json[]
      }
      rpc_cohort_counts: {
        Args: { p_assessment_id: string; p_floor: number }
        Returns: Json
      }
      rpc_comments_for_review: {
        Args: { p_assessment_id: string; p_assignment_id: string }
        Returns: {
          body: string
          comment_id: string
          question_code: string
          redacted: string
          reviewed: boolean
        }[]
      }
      rpc_comparison_store: {
        Args: {
          p_actor: string
          p_baseline: string
          p_baseline_version: number
          p_current: string
          p_current_version: number
          p_deltas: Json
          p_relation: string
        }
        Returns: string
      }
      rpc_completion_stats: {
        Args: { p_assessment: string; p_min: number }
        Returns: Json
      }
      rpc_counts_360: { Args: { p_assessment_id: string }; Returns: Json }
      rpc_destroy_responses: { Args: { p_engagement: string }; Returns: Json }
      rpc_development_agree: {
        Args: {
          p_actor: string
          p_assessment: string
          p_assignment: string
          p_version: number
        }
        Returns: Json
      }
      rpc_development_store: {
        Args: {
          p_actor: string
          p_assessment: string
          p_items: Json
          p_version: number
        }
        Returns: Json
      }
      rpc_development_update: {
        Args: { p_actor: string; p_fields: Json; p_item: string }
        Returns: undefined
      }
      rpc_engagement_consultants: {
        Args: { p_engagement: string }
        Returns: Json
      }
      rpc_erase_invitation: { Args: { p_token: string }; Returns: boolean }
      rpc_evidence_add: {
        Args: {
          p_action: string
          p_actor: string
          p_content_type?: string
          p_description: string
          p_file_key?: string
          p_file_name?: string
          p_file_size?: number
          p_kind: string
          p_link: string
        }
        Returns: string
      }
      rpc_extend_window: {
        Args: {
          p_approved_by: string
          p_assessment_id: string
          p_new_close: string
          p_reason: string
          p_requested_by: string
          p_working_days: number
        }
        Returns: number
      }
      rpc_fielding_counts: { Args: { p_assessment_id: string }; Returns: Json }
      rpc_frozen_360_set: { Args: { p_assessment_id: string }; Returns: Json }
      rpc_frozen_response_set: {
        Args: { p_assessment_id: string }
        Returns: Json[]
      }
      rpc_invitation_prefill: { Args: { p_token: string }; Returns: Json }
      rpc_issue_360_invitations: {
        Args: { p_assessment_id: string; p_expires_at?: string; p_items: Json }
        Returns: {
          assignment_id: string
          kind: string
          person_id: string
          token: string
        }[]
      }
      rpc_issue_invitations: {
        Args: {
          p_assessment_id: string
          p_count: number
          p_expires_at?: string
          p_snapshot?: Json
        }
        Returns: string[]
      }
      rpc_issue_person_invitations: {
        Args: {
          p_assessment_id: string
          p_expires_at?: string
          p_people: string[]
        }
        Returns: {
          person_id: string
          token: string
        }[]
      }
      rpc_kpi_reading_add: {
        Args: {
          p_action: string
          p_actor: string
          p_note: string
          p_read_on: string
          p_value: string
        }
        Returns: undefined
      }
      rpc_launch_assessment: {
        Args: {
          p_actor: string
          p_assessment: string
          p_defects: Json
          p_graph_version: number
          p_scope: Json
          p_window_start: string
        }
        Returns: Json
      }
      rpc_leaders_replace: {
        Args: { p_actor: string; p_engagement: string; p_leaders: Json }
        Returns: Json
      }
      rpc_load_draft: { Args: { p_token: string }; Returns: Json }
      rpc_location_countries_set: {
        Args: { p_actor: string; p_engagement: string; p_locations: Json }
        Returns: Json
      }
      rpc_log_segment_query: {
        Args: {
          p_actor: string
          p_assessment_id: string
          p_axis: string
          p_outcome: string
          p_predicates: Json
          p_resolved?: number
        }
        Returns: undefined
      }
      rpc_monitor_set: { Args: { p_assessment_id: string }; Returns: Json[] }
      rpc_my_assignments: { Args: never; Returns: string[] }
      rpc_my_person: { Args: never; Returns: string }
      rpc_my_profile: { Args: never; Returns: Json }
      rpc_nominations_decide: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_assessment: string
          p_assignment: string
        }
        Returns: Json
      }
      rpc_nominations_propose: {
        Args: {
          p_actor: string
          p_assessment: string
          p_assignment: string
          p_noms: Json
        }
        Returns: Json
      }
      rpc_nominations_replace: {
        Args: {
          p_actor: string
          p_assessment: string
          p_assignment: string
          p_noms: Json
        }
        Returns: Json
      }
      rpc_org_change_add: {
        Args: {
          p_actor: string
          p_description: string
          p_effective: string
          p_engagement: string
          p_type: string
        }
        Returns: string
      }
      rpc_org_graph_replace: {
        Args: { p_actor: string; p_engagement: string; p_graph: Json }
        Returns: Json
      }
      rpc_org_override_set: {
        Args: {
          p_actor: string
          p_engagement: string
          p_reason: string
          p_rule: string
        }
        Returns: Json
      }
      rpc_p0_complete: {
        Args: {
          p_actor: string
          p_assessment: string
          p_item: string
          p_note: string
          p_version: number
        }
        Returns: undefined
      }
      rpc_password_changed: { Args: { p_user: string }; Returns: undefined }
      rpc_plan_order_set: {
        Args: {
          p_actor: string
          p_assessment: string
          p_ranking: string[]
          p_version: number
        }
        Returns: undefined
      }
      rpc_plan_propose: {
        Args: { p_assessment: string; p_version: number }
        Returns: number
      }
      rpc_plan_store: {
        Args: {
          p_actor: string
          p_assessment: string
          p_hash: string
          p_plan: Json
          p_start: string
          p_version: number
        }
        Returns: Json
      }
      rpc_pulse_close: {
        Args: { p_actor: string; p_pulse: string }
        Returns: undefined
      }
      rpc_pulse_counts: { Args: { p_pulse: string }; Returns: Json }
      rpc_pulse_create: {
        Args: {
          p_actor: string
          p_assessment: string
          p_baseline: Json
          p_items: string[]
          p_priority: string
          p_review_point: string
          p_score_version: number
        }
        Returns: string
      }
      rpc_pulse_open: {
        Args: { p_actor: string; p_closes: string; p_pulse: string }
        Returns: Json[]
      }
      rpc_pulse_result_store: {
        Args: {
          p_actor: string
          p_invited: number
          p_pulse: string
          p_reading: Json
          p_responded: number
          p_triggers: Json
        }
        Returns: boolean
      }
      rpc_pulse_status: { Args: { p_token: string }; Returns: Json }
      rpc_pulse_submit: {
        Args: { p_answers: Json; p_token: string }
        Returns: undefined
      }
      rpc_rater_meta_360: { Args: { p_assessment_id: string }; Returns: Json }
      rpc_record_consent: {
        Args: { p_decision: string; p_token: string }
        Returns: Json
      }
      rpc_review_comment: {
        Args: {
          p_actor: string
          p_assessment_id: string
          p_comment_id: string
          p_redacted: string
        }
        Returns: undefined
      }
      rpc_revoke_person_links: {
        Args: { p_employee_ref: string; p_tenant_id: string }
        Returns: number
      }
      rpc_rights_context: { Args: { p_token: string }; Returns: Json }
      rpc_role_tags_set: {
        Args: { p_actor: string; p_engagement: string; p_tags: Json }
        Returns: Json
      }
      rpc_rollover_create: {
        Args: {
          p_actions: string[]
          p_actor: string
          p_carry: Json
          p_previous: string
        }
        Returns: Json
      }
      rpc_save_draft: {
        Args: { p_payload: Json; p_token: string }
        Returns: undefined
      }
      rpc_set_invitation_attributes: {
        Args: { p_attrs: Json; p_token: string }
        Returns: boolean
      }
      rpc_status_360: { Args: { p_token: string }; Returns: Json }
      rpc_submit_360: {
        Args: { p_meta?: Json; p_ratings: Json; p_token: string }
        Returns: undefined
      }
      rpc_submit_response: {
        Args: {
          p_duration?: number
          p_language?: string
          p_payload: Json
          p_token: string
        }
        Returns: undefined
      }
      rpc_survey_status: { Args: { p_token: string }; Returns: Json }
      rpc_tenant_logo_set: {
        Args: {
          p_actor: string
          p_data: string
          p_tenant: string
          p_type: string
        }
        Returns: undefined
      }
      rpc_tenant_staff: { Args: { p_tenant: string }; Returns: Json }
      rpc_tenure_bands_replace: {
        Args: { p_actor: string; p_bands: Json; p_engagement: string }
        Returns: Json
      }
      rpc_trigger_decide: {
        Args: {
          p_actor: string
          p_decision: string
          p_reason: string
          p_trigger: string
        }
        Returns: undefined
      }
      rpc_trigger_raise: {
        Args: {
          p_actor: string
          p_engagement: string
          p_ref: string
          p_type: string
        }
        Returns: string
      }
      rpc_user_authorize: {
        Args: { p_actor: string; p_user: string }
        Returns: undefined
      }
      rpc_user_create: {
        Args: {
          p_actor: string
          p_engagement?: string
          p_name: string
          p_role: string
          p_tenant: string
          p_user: string
          p_valid_to?: string
        }
        Returns: undefined
      }
      rpc_user_link_person: {
        Args: { p_actor: string; p_person: string; p_user: string }
        Returns: undefined
      }
      rpc_user_mark_temp: {
        Args: { p_actor: string; p_user: string }
        Returns: undefined
      }
      rpc_user_update: {
        Args: {
          p_active?: boolean
          p_actor: string
          p_role?: string
          p_user: string
        }
        Returns: undefined
      }
      rpc_users_list: { Args: { p_actor: string }; Returns: Json }
    }
    Enums: {
      engagement_state:
        | "SETUP"
        | "FIELDING"
        | "SCORING"
        | "REPORTING"
        | "DEBRIEF"
        | "PLANNING"
        | "IMPLEMENTATION"
        | "PULSE"
        | "RE_ASSESSMENT"
        | "CLOSED"
      staff_role:
        | "SUPER_ADMIN"
        | "PAC_CONSULTANT"
        | "CLIENT_ADMIN"
        | "EXECUTIVE"
        | "PEOPLE_LEADER"
        | "COACH"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      engagement_state: [
        "SETUP",
        "FIELDING",
        "SCORING",
        "REPORTING",
        "DEBRIEF",
        "PLANNING",
        "IMPLEMENTATION",
        "PULSE",
        "RE_ASSESSMENT",
        "CLOSED",
      ],
      staff_role: [
        "SUPER_ADMIN",
        "PAC_CONSULTANT",
        "CLIENT_ADMIN",
        "EXECUTIVE",
        "PEOPLE_LEADER",
        "COACH",
      ],
    },
  },
} as const
