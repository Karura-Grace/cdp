/**
 * Rules data, version 2.0 (spec §5.5–§5.6): pathway library, playbook defaults, urgency tiers, action workflow.
 * Generated from the oracle (oracle/cdp_oracle/planning.py). Edit through a new rules version, never in place.
 */
export const RULES_2_0 = {
 "rules_version": "2.0",
 "pathways": [
  {
   "from": "PERFORM",
   "to": "ENGAGE",
   "narrative": "“We perform best when our people are at their best.”",
   "interventions": "Coach-first leadership development; CDP-anchored 360; wellbeing investment; team-based recognition."
  },
  {
   "from": "ENGAGE",
   "to": "PERFORM",
   "narrative": "“Delivering for our customers is how we secure each other’s future.”",
   "interventions": "Commercial acumen; objective-setting rigour; performance-conversation skills; visible scoreboard."
  },
  {
   "from": "GOVERN",
   "to": "INNOVATE",
   "narrative": "“Our discipline is what lets us experiment safely.”",
   "interventions": "Innovation sprints; permission to fail; fewer approval layers; ring-fenced experimentation budget."
  },
  {
   "from": "INNOVATE",
   "to": "GOVERN",
   "narrative": "“Good systems let our best ideas scale.”",
   "interventions": "Process discipline; documentation; quality management system; governance training."
  },
  {
   "from": "ENGAGE",
   "to": "INNOVATE",
   "narrative": "“Our trust is the safety net for bold ideas.”",
   "interventions": "Idea forums; action learning; protected experimentation time."
  },
  {
   "from": "INNOVATE",
   "to": "ENGAGE",
   "narrative": "“Great ideas need great teams.”",
   "interventions": "Mentoring; team rituals; retention plans for creative talent."
  },
  {
   "from": "ENGAGE",
   "to": "GOVERN",
   "narrative": "“Fairness and consistency are how we care at scale.”",
   "interventions": "Role clarity; standardised people processes; documented decision rights."
  },
  {
   "from": "GOVERN",
   "to": "ENGAGE",
   "narrative": "“Our standards exist to serve the people who deliver them.”",
   "interventions": "Manager coaching capability; participative process design."
  },
  {
   "from": "INNOVATE",
   "to": "PERFORM",
   "narrative": "“Ideas only count when customers pay for them.”",
   "interventions": "Phase-gate discipline; commercial targets on the portfolio."
  },
  {
   "from": "PERFORM",
   "to": "INNOVATE",
   "narrative": "“Tomorrow’s targets depend on today’s experiments.”",
   "interventions": "Innovation objectives in scorecards; sandbox time; pilot funding."
  },
  {
   "from": "PERFORM",
   "to": "GOVERN",
   "narrative": "“Reliability is how we keep winning.”",
   "interventions": "Control framework; quality metrics beside delivery metrics."
  },
  {
   "from": "GOVERN",
   "to": "PERFORM",
   "narrative": "“Our systems exist to deliver results, not to be admired.”",
   "interventions": "Outcome measures; customer proximity; delegated decision rights."
  }
 ],
 "playbook": {
  "ENGAGE": {
   "signal": "CEO publicly recognises a manager for developing talent at an all-staff forum.",
   "levers": [
    {
     "lever": "PERFORMANCE_MANAGEMENT",
     "text": "Add a people-development objective to every manager’s scorecard."
    },
    {
     "lever": "PROMOTION",
     "text": "Make a track record of developing others a promotion criterion."
    },
    {
     "lever": "REWARD",
     "text": "Recognise team outcomes, not only individual ones."
    },
    {
     "lever": "ONBOARDING",
     "text": "Assign a buddy and hold structured 30/60/90-day check-ins."
    }
   ],
   "medium": "Coach-first leadership programme with a CDP-anchored 360 baseline and re-measure.",
   "watch": [
    "D2 S2",
    "D3 S2",
    "D4 S2",
    "D8",
    "eOS Q1",
    "eOS Q4",
    "eOS Q6",
    "eOS Q7"
   ]
  },
  "INNOVATE": {
   "signal": "Publicly celebrate a well-run experiment that failed, and share what was learned.",
   "levers": [
    {
     "lever": "PERFORMANCE_MANAGEMENT",
     "text": "Include an innovation or improvement objective in scorecards."
    },
    {
     "lever": "PROMOTION",
     "text": "Reward intelligent risk-taking and learning from failure."
    },
    {
     "lever": "REWARD",
     "text": "Fund an innovation budget or protected time; recognise experiments as well as successes."
    },
    {
     "lever": "DECISION_RIGHTS",
     "text": "Remove the full-business-case requirement before a pilot below a set value."
    }
   ],
   "medium": "Run three 90-day customer-journey innovation sprints with a ring-fenced budget.",
   "watch": [
    "D1 S3",
    "D2 S1",
    "D5 S1",
    "D5 S3",
    "D7",
    "D8",
    "eOS Q3"
   ]
  },
  "PERFORM": {
   "signal": "Publish a simple team scoreboard and publicly recognise a delivery win against it.",
   "levers": [
    {
     "lever": "PERFORMANCE_MANAGEMENT",
     "text": "Cascade clear targets with a quarterly review rhythm."
    },
    {
     "lever": "PROMOTION",
     "text": "Base promotion on delivered, measurable results."
    },
    {
     "lever": "REWARD",
     "text": "Link variable pay to a small number of measurable outcomes."
    },
    {
     "lever": "ONBOARDING",
     "text": "Set clear performance expectations in the first week."
    }
   ],
   "medium": "Performance-conversation capability programme for all people managers.",
   "watch": [
    "D2 S1",
    "D2 S3",
    "D3 S3",
    "D5 S1",
    "D6 S1",
    "D6 S2",
    "D6 S3",
    "eOS Q8",
    "D8"
   ]
  },
  "GOVERN": {
   "signal": "Fix one visible process bottleneck staff complain about, and communicate what changed.",
   "levers": [
    {
     "lever": "PERFORMANCE_MANAGEMENT",
     "text": "Clarify roles and include quality and compliance measures."
    },
    {
     "lever": "PROMOTION",
     "text": "Reward reliability, quality and sound judgement on risk."
    },
    {
     "lever": "REWARD",
     "text": "Recognise error reduction and process improvements."
    },
    {
     "lever": "DECISION_RIGHTS",
     "text": "Revise the delegation-of-authority matrix to remove redundant sign-offs."
    }
   ],
   "medium": "Map the top five approval flows and remove at least two layers in each.",
   "watch": [
    "D1 S2",
    "D3 S1",
    "D5 S2",
    "D6 S3",
    "D9"
   ]
  }
 },
 "tiers": {
  "STRATEGIC_MISS": {
   "owner_role": "CEO+CHRO",
   "due_days": 30,
   "urgency": 5
  },
  "BEHAVIOUR_GAP": {
   "owner_role": "CHRO+PEOPLE_MANAGERS",
   "due_days": 90,
   "urgency": 4
  },
  "PROCESS_CONTRADICTION": {
   "owner_role": "CHRO+OD",
   "due_days": 180,
   "urgency": 3
  },
  "MODEL_READINESS": {
   "owner_role": "CEO+EXCO",
   "due_days": 540,
   "urgency": 2
  },
  "PRE_CONDITION": {
   "owner_role": "CEO+CHRO",
   "due_days": 30,
   "urgency": 5
  }
 },
 "transitions": [
  {
   "from": "DRAFT",
   "to": "IN_REVIEW",
   "roles": [
    "PAC_CONSULTANT"
   ]
  },
  {
   "from": "DRAFT",
   "to": "DISCARDED",
   "roles": [
    "PAC_CONSULTANT"
   ]
  },
  {
   "from": "IN_REVIEW",
   "to": "IN_CO_DESIGN",
   "roles": [
    "PAC_CONSULTANT"
   ]
  },
  {
   "from": "IN_CO_DESIGN",
   "to": "APPROVED",
   "roles": [
    "EXECUTIVE",
    "PEOPLE_LEADER"
   ]
  },
  {
   "from": "APPROVED",
   "to": "PUBLISHED",
   "roles": [
    "PAC_CONSULTANT"
   ]
  },
  {
   "from": "PUBLISHED",
   "to": "IN_PROGRESS",
   "roles": [
    "CLIENT_ADMIN",
    "EXECUTIVE",
    "PEOPLE_LEADER"
   ]
  },
  {
   "from": "IN_PROGRESS",
   "to": "UNDER_REVIEW",
   "roles": [
    "CLIENT_ADMIN",
    "EXECUTIVE",
    "PEOPLE_LEADER"
   ]
  },
  {
   "from": "UNDER_REVIEW",
   "to": "IN_PROGRESS",
   "roles": [
    "EXECUTIVE",
    "PAC_CONSULTANT",
    "PEOPLE_LEADER"
   ]
  },
  {
   "from": "UNDER_REVIEW",
   "to": "CLOSED",
   "roles": [
    "EXECUTIVE",
    "PEOPLE_LEADER"
   ]
  },
  {
   "from": "UNDER_REVIEW",
   "to": "RETIRED",
   "roles": [
    "EXECUTIVE",
    "PAC_CONSULTANT",
    "PEOPLE_LEADER"
   ]
  }
 ],
 "mandatory_for_approval": [
  "owner",
  "sponsor",
  "kpi",
  "baseline_value",
  "target_value",
  "start_date",
  "end_date"
 ]
} as const;
