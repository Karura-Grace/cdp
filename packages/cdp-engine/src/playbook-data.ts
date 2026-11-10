/**
 * The orientation playbooks (spec Part B, 11.7 to 11.10; PAC/CDP/ACT/001), loaded as versioned reference data. Generated once from the
 * 17 October 2026 specification by a script, then owned by PAC faculty: a content change is a new PLAYBOOK_VERSION, and a plan or report
 * records the version it used. Wording only, no calculation, so the oracle has no copy.
 * ponytail: faculty edit this file through a release. Move it into a table when edits become frequent.
 */
import type { Orientation } from "./num.js";

export const PLAYBOOK_VERSION = "1.0";

export interface PlaybookTable { columns: string[]; rows: { label: string; values: string[][] }[] }
export interface Playbook {
  tagline: string; intro: string;
  /** Attribute and specification: focus, values, leader type, strengths, overplay risks, relationships, where it shows in CDP results. */
  profile: { attribute: string; specification: string[] }[];
  /** If the leader, team, unit or organisation is this orientation: how to work with, or build, each other orientation. */
  matrix: { note: string; columns: string[]; rows: { label: string; cells: string[] }[] };
  /** The two value pairs this orientation drives, with the headline metric, indicators, what to nurture, blind spots and typical contexts. */
  metrics: PlaybookTable;
  /** The candidate action library: what individuals and leaders do, team priorities, HR and system levers, the visible 30 day signal, the watch list. */
  actions: { when: string; columns: string[]; rows: { label: string; values: string[][] }[] };
}

export const ORIENTATION_PLAYBOOK: Record<Orientation, Playbook> = {
 "ENGAGE": {
  "tagline": "People + Belonging · inward focus + adaptive · “We grow our people”",
  "intro": "ENGAGE describes a people-centred community in which deep relationships, mutual care and shared purpose shape daily experience. Leaders act as coaches and mentors, people invest in one another’s growth, and success is measured by how well people thrive over the long term.",
  "profile": [
   {
    "attribute": "Core focus",
    "specification": [
     "People + Belonging"
    ]
   },
   {
    "attribute": "Values",
    "specification": [
     "Belonging · shared commitment · growing people · open participation · lasting relationships"
    ]
   },
   {
    "attribute": "Leader type",
    "specification": [
     "Coaches · develops · unites the team"
    ]
   },
   {
    "attribute": "How it creates value",
    "specification": [
     "Value is created when people are developed, trusted and committed to one another."
    ]
   },
   {
    "attribute": "Strengths when anchored here",
    "specification": [
     "People feel valued and leaders are grown from within.",
     "Human capital is the engine of organisational success.",
     "The organisation plans and invests for the long term."
    ]
   },
   {
    "attribute": "Overplay risks (drawbacks at the extreme)",
    "specification": [
     "Becomes a “comfort club”: warmth without accountability.",
     "Initiatives are slow to produce tangible outcomes.",
     "Goals keep shifting and focus is lost."
    ]
   },
   {
    "attribute": "Relationship to other orientations",
    "specification": [
     "Complements INNOVATE and GOVERN. Contrasts (diagonally) with PERFORM."
    ]
   },
   {
    "attribute": "Where it shows in CDP results",
    "specification": [
     "High ENGAGE allocation in D1 (Cultural DNA), D2 Scenario 2 (how leaders invest their time), D4 Scenario 2 (what makes people stay) and D6 Scenarios 1 and 3. Cross-check eOS Q1, Q4, Q6 and Q7."
    ]
   }
  ],
  "matrix": {
   "note": "Each matrix is used in three ways: (a) when an individual leader, team, department or the whole organisation has a dominant profile in this orientation and must work with a group whose dominant orientation differs, for example cohorts or departments in the sub-culture map; (b) when a culture dominant in this orientation must build more of another; (c) when partnering externally. Complementary rows show where value comes easily; the contrasting (diagonal) row shows where friction will arise and how to manage it. The platform attaches the row for the relevant level to cascade packs, sub-culture reports and leader reports.",
   "columns": [
    "If you (leader) are ENGAGE",
    "If your team is ENGAGE",
    "If your department / unit is ENGAGE",
    "If your organisation is ENGAGE"
   ],
   "rows": [
    {
     "label": "On its own, value comes from…",
     "cells": [
      "Your commitment to teaching, mentoring and developing others.",
      "The team’s commitment to learning together and supporting each member’s growth.",
      "Building organisational learning that other units can draw on.",
      "Turning people capability and shared knowledge into a lasting competitive advantage."
     ]
    },
    {
     "label": "And you work with, or must build, GOVERN (complement)…",
     "cells": [
      "Works well when you jointly focus on learning to do things the right way.",
      "Creates value with other teams when good practice and standard ways of working are shared openly.",
      "Succeeds when structured learning systems (SOPs, knowledge bases, communities of practice) are built and shared.",
      "Builds value through long-term, trusted partnerships that develop sector-specific knowledge and standards."
     ]
    },
    {
     "label": "And you work with, or must build, INNOVATE (complement)…",
     "cells": [
      "Works well when you try new things together, generate ideas, and learn supportively from what does and does not work.",
      "Creates value by co-creating on projects and reviewing openly what worked and what to improve.",
      "Succeeds when larger innovation initiatives are launched and patiently nurtured over the long term.",
      "Builds value through innovative, long-term alliances or joint ventures aimed at creating new knowledge."
     ]
    },
    {
     "label": "And you work with, or must build, PERFORM (contrast: expect friction)…",
     "cells": [
      "Friction centres on individual deadlines and accountability. Let them set timelines, but lead on clarifying details and keep communication about shared responsibilities positive.",
      "Agreeing shared objectives is hard: your goals may look soft to them, theirs too aggressive to you. Make your team’s goals concrete and express them in the language of results.",
      "Tension between speed of completion and time to learn. Set realistic objectives that balance pace with learning and keep communication strong.",
      "Deep trust is slow to build because the two sides move at different speeds. Anchor the relationship on one specific project with realistic deadlines and use milestones as trust checkpoints."
     ]
    }
   ]
  },
  "metrics": {
   "columns": [
    "Belonging",
    "Human development"
   ],
   "rows": [
    {
     "label": "Headline performance metric",
     "values": [
      [
       "Voluntary retention of staff and key talent, read alongside revenue (or output) per employee."
      ],
      [
       "Capability growth: internal fill-rate for key roles, skills-index progression and bench strength for critical positions."
      ]
     ]
    },
    {
     "label": "Supporting indicators",
     "values": [
      [
       "eOS scores and morale surveys.",
       "Voluntary and performance-related turnover.",
       "Absence rate.",
       "Trend in grievances and complaints.",
       "Headcount against workforce plan.",
       "Job-offer acceptance rate.",
       "Internal promotion rate.",
       "Customer satisfaction."
      ],
      [
       "Completion of required training.",
       "Training days and investment per employee.",
       "Training spend as % of operating budget.",
       "% of staff with a career development plan.",
       "Employee suggestions adopted.",
       "Good practices shared across units.",
       "Skill targets achieved; impact evaluation of learning.",
       "Average experience level of staff."
      ]
     ]
    },
    {
     "label": "To achieve Belonging / Human development, nurture…",
     "values": [
      [
       "Workforce commitment",
       "Shared values",
       "Inclusion",
       "Teamwork",
       "Employee motivation"
      ],
      [
       "Workforce competence",
       "Continuous learning",
       "Retention of talent",
       "Employee support",
       "Breadth of knowledge to handle uncertainty"
      ]
     ]
    },
    {
     "label": "Cultures strong here are characterised by…",
     "values": [
      [
       "Friendly atmosphere",
       "Participation",
       "Team goals",
       "Mentorship",
       "People focus",
       "Good communication"
      ],
      [
       "Information sharing",
       "Collaborative learning",
       "Leaders as teachers",
       "Personal growth",
       "Diversity",
       "Organisation development practice"
      ]
     ]
    },
    {
     "label": "Leaders who build it tend to be…",
     "values": [
      [
       "Facilitator",
       "Consensus builder",
       "Inclusive",
       "Effective, empathetic communicator"
      ],
      [
       "Mentor",
       "Effective teacher",
       "Solution builder",
       "Open to ideas",
       "Supportive"
      ]
     ]
    },
    {
     "label": "Leadership blind spot to avoid",
     "values": [
      [
       "Assuming beliefs and attitudes are a minor issue. Allow real time to surface concerns and shift attitudes."
      ],
      [
       "Assuming the right people, values and skills are already in place. Keep scanning for talent and do not tolerate under-performance."
      ]
     ]
    },
    {
     "label": "Culture blind spots (overplay)",
     "values": [
      [
       "Conflict avoidance",
       "Over-consultation",
       "Groupthink",
       "Slow reaction",
       "Inward, narrow outlook"
      ],
      [
       "Neglect of the short term",
       "Slow reaction",
       "Soft feedback",
       "Inward, narrow outlook"
      ]
     ]
    },
    {
     "label": "Personal blind spots",
     "values": [
      [
       "Puts people ahead of tasks",
       "Defaults to cliques",
       "Disregards metrics"
      ],
      [
       "Wanders into non-essential knowledge",
       "Lacks focus",
       "Avoids direct confrontation"
      ]
     ]
    },
    {
     "label": "Typical contexts",
     "values": [
      [
       "Mission-driven NGOs, associations and member bodies, family businesses, professional partnerships, faith-based and community organisations."
      ]
     ]
    }
   ]
  },
  "actions": {
   "when": "Applied when ENGAGE is classified BUILD or STRENGTHEN, when it is the required orientation in a C1 or C4 miss, or when it is the target orientation in a C2 behaviour gap. These actions form the candidate library from which the engine drafts actions (8.2).",
   "columns": [
    "Belonging",
    "Human development"
   ],
   "rows": [
    {
     "label": "Actions individuals and leaders can take",
     "values": [
      [
       "Involve the people affected by a change in planning and implementing it.",
       "Create space for people to talk about their reactions, especially where they feel they are losing something.",
       "Identify change champions and work with them to lead the change.",
       "Hold regular feedback sessions on how the change is landing."
      ],
      [
       "Define objectives, roles and timelines clearly, then give people freedom to experiment within them.",
       "Explain what the change means for each group, then ask for and act on feedback.",
       "Seek advice widely before and during change.",
       "Learn from a leader who has implemented a similar change and test your plan with them."
      ]
     ]
    },
    {
     "label": "Priorities the team or organisation can set",
     "values": [
      [
       "Building cohesion across the organisation.",
       "Establishing genuinely shared values.",
       "Facilitating constructive conflict resolution.",
       "Integrating personal and professional goals.",
       "Encouraging commitment."
      ],
      [
       "Training, mentoring and coaching.",
       "Becoming a learning organisation.",
       "Building cross-functional teams.",
       "Nurturing communities of practice.",
       "Competency and culture development."
      ]
     ]
    },
    {
     "label": "HR and system levers (Setup Section H)",
     "values": [
      [
       "Performance management: add a people-development objective to every manager’s scorecard.",
       "Promotion: make a track record of developing others a promotion criterion.",
       "Reward: recognise team outcomes, not only individual ones.",
       "Onboarding: assign a buddy and hold structured 30/60/90-day check-ins."
      ]
     ]
    },
    {
     "label": "Visible signal within 30 days (Check C3)",
     "values": [
      [
       "Within 30 days, have the CEO publicly recognise a manager for developing talent, at an all-staff forum."
      ]
     ]
    },
    {
     "label": "CDP re-measurement watch-list",
     "values": [
      [
       "D2 S2 · D3 S2 · D4 S2 · D8 Psychological Safety · eOS Q1, Q4, Q6, Q7"
      ]
     ]
    }
   ]
  }
 },
 "INNOVATE": {
  "tagline": "Ideas + Agility · outward focus + adaptive · “We try new things”",
  "intro": "INNOVATE describes an ideas engine in which bold experimentation, creative challenge and the freedom to question convention shape daily experience. Work is often organised around projects, people are trusted to act without waiting for permission, and failure is treated as learning.",
  "profile": [
   {
    "attribute": "Core focus",
    "specification": [
     "Ideas + Agility"
    ]
   },
   {
    "attribute": "Values",
    "specification": [
     "Fresh thinking · experimentation · smart risk-taking · continual learning · forward vision"
    ]
   },
   {
    "attribute": "Leader type",
    "specification": [
     "Champions ideas · backs experiments · sets direction"
    ]
   },
   {
    "attribute": "How it creates value",
    "specification": [
     "Value is created through new ideas, experimentation and continuous renewal."
    ]
   },
   {
    "attribute": "Strengths when anchored here",
    "specification": [
     "Bold and breakthrough ideas regularly come to life.",
     "Adaptability and novelty drive organisational success.",
     "The organisation invests for the long term."
    ]
   },
   {
    "attribute": "Overplay risks (drawbacks at the extreme)",
    "specification": [
     "Energy scatters across too many initiatives and delivery becomes chaotic.",
     "Radical ideas are expensive and often fail.",
     "Stretch goals are frequent and often unachievable."
    ]
   },
   {
    "attribute": "Relationship to other orientations",
    "specification": [
     "Complements ENGAGE and PERFORM. Contrasts (diagonally) with GOVERN."
    ]
   },
   {
    "attribute": "Where it shows in CDP results",
    "specification": [
     "High INNOVATE allocation in D1 Scenario 3 (response to adversity), D2 Scenario 1 (leadership orientation), D5 Scenarios 1 and 3 (strategy and long-term investment). Cross-check D7 Digital Readiness, D8 and eOS Q3."
    ]
   }
  ],
  "matrix": {
   "note": "Used exactly as described at 11.7.2.",
   "columns": [
    "If you (leader) are INNOVATE",
    "If your team is INNOVATE",
    "If your department / unit is INNOVATE",
    "If your organisation is INNOVATE"
   ],
   "rows": [
    {
     "label": "On its own, value comes from…",
     "cells": [
      "Your ability to turn creative risk into growth projects.",
      "The team’s support for playfulness, divergent thinking and calculated risk.",
      "Creating idea spaces and structures that support creativity and divergence.",
      "Systems and cultures of risk-taking in which free-thinking projects are funded as a channel for growth."
     ]
    },
    {
     "label": "And you work with, or must build, ENGAGE (complement)…",
     "cells": [
      "Works well when you jointly emphasise trying new things, generating ideas, and learning from each other supportively.",
      "Creates value by collaborating on creative projects and learning together about what works.",
      "Succeeds when large innovation initiatives are launched and nurtured for long-term success.",
      "Builds value through innovative, long-term alliances aimed at generating new industry knowledge."
     ]
    },
    {
     "label": "And you work with, or must build, PERFORM (complement)…",
     "cells": [
      "Works well when you share energy and visible sponsorship for a high-profile project.",
      "Creates value through shared enthusiasm for launching new initiatives.",
      "Succeeds when know-how on phase-gate reviews of profitable, visible growth projects is shared.",
      "Builds value when a partnership provides the capital for large, visible, innovative growth projects."
     ]
    },
    {
     "label": "And you work with, or must build, GOVERN (contrast: expect friction)…",
     "cells": [
      "Friction centres on risk: big ideas look reckless if not carefully presented. Set out the reasonable risks and foreseeable rewards analytically.",
      "Your ideas will be challenged on feasibility. Build a proof of concept that answers the feasibility questions directly.",
      "Conflicting views on how to pursue growth and weigh risk against reward. Accept that risk is inevitable and propose creative ways to mitigate it.",
      "Large formal partnerships are hard. Treat these partners as a source of specific capabilities and use smaller, targeted alliances."
     ]
    }
   ]
  },
  "metrics": {
   "columns": [
    "Ideas",
    "Agility"
   ],
   "rows": [
    {
     "label": "Headline performance metric",
     "values": [
      [
       "Share of revenue (or impact) from products, services or programmes launched in the last three years."
      ],
      [
       "Idea-to-launch cycle time: average time from approved concept to first customer or beneficiary use."
      ]
     ]
    },
    {
     "label": "Supporting indicators",
     "values": [
      [
       "New products, services or programmes launched.",
       "Ideas submitted and adopted per 100 staff.",
       "Experiments run per quarter.",
       "Return on new offerings.",
       "Innovation spend as % of total spend.",
       "Diversity of the innovation portfolio.",
       "Survival rate of launches after 12 months."
      ],
      [
       "Time to market for new offerings.",
       "% of experiments reaching a go / stop decision on schedule.",
       "Pilots successfully scaled.",
       "Staff working in cross-functional project teams.",
       "Digital adoption rate (link to D7).",
       "Speed of response to competitor, customer or regulatory change.",
       "Lessons-learned reviews completed and applied (link to D9)."
      ]
     ]
    },
    {
     "label": "To achieve Ideas / Agility, nurture…",
     "values": [
      [
       "Product and service innovation",
       "Long-term risk acceptance",
       "Experimentation",
       "Change",
       "Capacity to capitalise on trends"
      ],
      [
       "Capacity to change",
       "Long-term risk acceptance",
       "A vision of what is possible",
       "Exploration",
       "Turning emerging trends into offerings"
      ]
     ]
    },
    {
     "label": "Cultures strong here are characterised by…",
     "values": [
      [
       "Entrepreneurship",
       "Creative workspaces",
       "Individual freedom",
       "Experimentation",
       "Tolerance of ambiguity and risk"
      ],
      [
       "Adventure and curiosity",
       "Emergent opportunities",
       "Clear vision",
       "Trend awareness",
       "Confronting the unknown"
      ]
     ]
    },
    {
     "label": "Leaders who build it tend to be…",
     "values": [
      [
       "Innovative, clever, creative",
       "Risk-taking",
       "Learns from failure",
       "Tolerant of ambiguity; abstract thinker"
      ],
      [
       "Visionary, future-oriented",
       "Visualises new outcomes",
       "Opportunistic, intuitive",
       "Risk-taker"
      ]
     ]
    },
    {
     "label": "Leadership blind spot to avoid",
     "values": [
      [
       "Assuming continued success depends solely on continuous change. Keep weighing the risks and rewards of every change."
      ],
      [
       "Assuming the future is an extension of the present. Expect disruption to growth rates and have a plan for it."
      ]
     ]
    },
    {
     "label": "Culture blind spots (overplay)",
     "values": [
      [
       "Excessive individualism",
       "Superficiality at the expense of depth"
      ],
      [
       "Misaligned incentives",
       "Low organisational loyalty"
      ]
     ]
    },
    {
     "label": "Personal blind spots",
     "values": [
      [
       "Risky behaviour",
       "Falls in love with ideas",
       "Micromanages",
       "Cannot rally support"
      ],
      [
       "Fails to produce viable ideas",
       "Low loyalty to the organisation",
       "Micromanages",
       "Will not adapt personal ideas to other objectives"
      ]
     ]
    },
    {
     "label": "Typical contexts",
     "values": [
      [
       "Start-ups and scale-ups, digital and platform businesses, design and creative firms, mature organisations that need renewal."
      ]
     ]
    }
   ]
  },
  "actions": {
   "when": "Applied when INNOVATE is classified BUILD or STRENGTHEN, when it is the required orientation in a C1 or C4 miss, or when it is the target orientation in a C2 behaviour gap. These actions form the candidate library from which the engine drafts actions (8.2).",
   "columns": [
    "Ideas",
    "Agility"
   ],
   "rows": [
    {
     "label": "Actions individuals and leaders can take",
     "values": [
      [
       "Run idea-sharing forums (cross-functional task forces, focus groups, reading circles) around two questions: what is new, and which of our problems does nobody expect us to solve?",
       "Practise action learning: try first, then review what success or failure taught you. Do not wait for certainty before acting.",
       "Deliberately test a new alternative or process in your own decisions.",
       "Keep an idea log and add to it every time an improvement occurs to you."
      ],
      [
       "Set goals for innovative ideas, hold people accountable for them, and write them into job descriptions.",
       "Create an innovation sandbox with protected time and modest resources for low-cost experiments.",
       "Build a climate where people can fail and say so openly.",
       "Generate as many options as possible when defining problems and solutions."
      ]
     ]
    },
    {
     "label": "Priorities the team or organisation can set",
     "values": [
      [
       "Jump-starting breakthrough experiments.",
       "Launching bold change programmes.",
       "Stimulating creative thinking.",
       "Retiring outdated ways of working.",
       "Hiring for diversity; creating a flexible, open workplace."
      ],
      [
       "Strategic foresight.",
       "Launching new ventures and spin-offs.",
       "Developing new products and services.",
       "Exploring emerging opportunities."
      ]
     ]
    },
    {
     "label": "HR and system levers (Setup Section H)",
     "values": [
      [
       "Performance management: include an innovation or improvement objective in scorecards.",
       "Promotion: reward intelligent risk-taking and learning from failure.",
       "Reward: fund an innovation budget or protected time; recognise experiments as well as successes.",
       "Onboarding: invite new hires to challenge one existing practice in their first 90 days."
      ]
     ]
    },
    {
     "label": "Visible signal within 30 days (Check C3)",
     "values": [
      [
       "Within 30 days, publicly celebrate a well-run experiment that failed, and share what was learned from it."
      ]
     ]
    },
    {
     "label": "CDP re-measurement watch-list",
     "values": [
      [
       "D1 S3 · D2 S1 · D5 S1, S3 · D7 Digital Readiness · D8 Psychological Safety · eOS Q3"
      ]
     ]
    }
   ]
  }
 },
 "PERFORM": {
  "tagline": "Results + Growth · outward focus + structured · “We deliver results”",
  "intro": "PERFORM describes a performance-driven culture in which ambitious goals, relentless execution and measurable outcomes shape daily experience. Leaders set challenging targets and track delivery closely, and the organisation competes hard for customers, market position and returns.",
  "profile": [
   {
    "attribute": "Core focus",
    "specification": [
     "Results + Growth"
    ]
   },
   {
    "attribute": "Values",
    "specification": [
     "Ambition · winning in the market · customer focus · clear targets · measurable returns"
    ]
   },
   {
    "attribute": "Leader type",
    "specification": [
     "Drives goals · delivers · competes to win"
    ]
   },
   {
    "attribute": "How it creates value",
    "specification": [
     "Value is created by setting ambitious goals, competing hard and staying close to customers."
    ]
   },
   {
    "attribute": "Strengths when anchored here",
    "specification": [
     "Initiatives stay focused on customer and shareholder / funder needs.",
     "Planning and focus drive organisational success.",
     "Short-term gains create tangible value."
    ]
   },
   {
    "attribute": "Overplay risks (drawbacks at the extreme)",
    "specification": [
     "Pace becomes unsustainable and burnout rises.",
     "Failures are not turned into learning.",
     "Competitive goals drive unsustainable behaviour."
    ]
   },
   {
    "attribute": "Relationship to other orientations",
    "specification": [
     "Complements INNOVATE and GOVERN. Contrasts (diagonally) with ENGAGE."
    ]
   },
   {
    "attribute": "Where it shows in CDP results",
    "specification": [
     "High PERFORM allocation in D2 Scenarios 1 and 3 (leadership orientation and recognition), D3 Scenario 3 (performance conversations), D5 Scenario 1 and D6 Scenarios 1–3. Cross-check eOS Q8 and the D8 score."
    ]
   }
  ],
  "matrix": {
   "note": "Used exactly as described at 11.7.2.",
   "columns": [
    "If you (leader) are PERFORM",
    "If your team is PERFORM",
    "If your department / unit is PERFORM",
    "If your organisation is PERFORM"
   ],
   "rows": [
    {
     "label": "On its own, value comes from…",
     "cells": [
      "Your ability to get things done fast and to meet clear, agreed metrics.",
      "A team that acts as a proving ground for leaders and high performers.",
      "Out-performing peer units, which clearly justifies the unit’s contribution.",
      "Systems that deliver superior returns to shareholders or funders relative to competitors."
     ]
    },
    {
     "label": "And you work with, or must build, INNOVATE (complement)…",
     "cells": [
      "Works well when you share energy and visible sponsorship for a high-profile project.",
      "Creates value through shared enthusiasm for launching new initiatives.",
      "Succeeds when know-how on phase-gate reviews of profitable, visible growth projects is shared.",
      "Builds value when a partnership provides the capital for large, visible, innovative growth projects."
     ]
    },
    {
     "label": "And you work with, or must build, GOVERN (complement)…",
     "cells": [
      "Works well when you share an interest in minimising a specific risk.",
      "Creates value with other teams around a specific shared goal that reduces risk and maximises return on investment.",
      "Succeeds through key projects with clear goals, timelines, responsibilities and outcomes.",
      "Builds value where joint ventures have clear objectives and resources. Ventures stay transactional and outcome-focused."
     ]
    },
    {
     "label": "And you work with, or must build, ENGAGE (contrast: expect friction)…",
     "cells": [
      "Friction centres on individual deadlines and responsibilities. Allow time for positive communication and for discussing roles but take the lead in setting reasonable targets and deliverables.",
      "Agreeing shared objectives is hard: yours may look aggressive, theirs vague. Push for realistic goals that leave room for some failure and learning.",
      "Tension between speed of completion and time to learn. Set realistic objectives that balance both and keep communication strong.",
      "Quick action is hard because collaboration and trust take time. Anchor the relationship on one specific project with realistic deadlines and milestones as trust checkpoints."
     ]
    }
   ]
  },
  "metrics": {
   "columns": [
    "Results",
    "Growth"
   ],
   "rows": [
    {
     "label": "Headline performance metric",
     "values": [
      [
       "Economic profit: operating profit after tax less a charge for the capital employed. For NGOs and public bodies, use cost per outcome or delivery against target."
      ],
      [
       "Revenue and market-share growth, year on year and over the strategic horizon. For NGOs, growth in funding or reach."
      ]
     ]
    },
    {
     "label": "Supporting indicators",
     "values": [
      [
       "Return on assets.",
       "Gross profit and operating income.",
       "Cash flow and cash on hand.",
       "% attainment of agreed targets.",
       "Projects delivered on or ahead of schedule.",
       "Bid and proposal win rate.",
       "Shareholder value and earnings per share (listed entities)."
      ],
      [
       "Total revenue growth.",
       "Market share against competitors.",
       "Growth by segment, channel and geography.",
       "Revenue from new markets.",
       "Customer acquisition and retention.",
       "Time to profitability for new offerings.",
       "Growth through partnerships and acquisitions."
      ]
     ]
    },
    {
     "label": "To achieve Results / Growth, nurture…",
     "values": [
      [
       "Shareholder / stakeholder value",
       "Predictable opportunities",
       "Focus to compete",
       "Short-term results",
       "Well-managed resources"
      ],
      [
       "Market share",
       "Opportunity capture",
       "Quick response",
       "Competitive drive",
       "Adaptability to fast-changing markets"
      ]
     ]
    },
    {
     "label": "Cultures strong here are characterised by…",
     "values": [
      [
       "Results orientation",
       "Targeted focus",
       "Demanding leadership",
       "Resources aligned to specific purposes",
       "Managerial discipline"
      ],
      [
       "Fast decision-making",
       "Hard-driving pace",
       "Leveraging assets",
       "Analytical strength",
       "Cost competition"
      ]
     ]
    },
    {
     "label": "Leaders who build it tend to be…",
     "values": [
      [
       "Competitor",
       "Demanding",
       "Energising",
       "Strategic"
      ],
      [
       "Producer",
       "Task-focused",
       "Aggressive and decisive",
       "Resourceful"
      ]
     ]
    },
    {
     "label": "Leadership blind spot to avoid",
     "values": [
      [
       "Assuming long-term stakeholder value is unimportant. Business decisions must weigh long-term value to owners and funders."
      ],
      [
       "Assuming every new idea or product has what it takes to enter and win new markets. Do the analysis before making fast decisions."
      ]
     ]
    },
    {
     "label": "Culture blind spots (overplay)",
     "values": [
      [
       "Stinginess",
       "Unrealistic targets"
      ],
      [
       "Burnout work pace",
       "Unnecessary aggression",
       "Waste"
      ]
     ]
    },
    {
     "label": "Personal blind spots",
     "values": [
      [
       "Takes the easy quick fix",
       "Short-sighted",
       "Unrealistic demands",
       "Poor with people"
      ],
      [
       "Takes the easy quick fix",
       "Overly aggressive",
       "Moves too fast",
       "Poor with people"
      ]
     ]
    },
    {
     "label": "Typical contexts",
     "values": [
      [
       "Banks and financial institutions, large listed or diversified companies, sector leaders, sales-led and commercially driven businesses."
      ]
     ]
    }
   ]
  },
  "actions": {
   "when": "Applied when PERFORM is classified BUILD or STRENGTHEN, when it is the required orientation in a C1 or C4 miss, or when it is the target orientation in a C2 behaviour gap. These actions form the candidate library from which the engine drafts actions (8.2).",
   "columns": [
    "Results",
    "Growth"
   ],
   "rows": [
    {
     "label": "Actions individuals and leaders can take",
     "values": [
      [
       "Benchmark against leading organisations and define what “world-class” would require of you.",
       "Recognise and celebrate cost savings, however small.",
       "Make continuous improvement an explicit part of the unit’s vision.",
       "Make it easy for staff and customers to complain and suggest. Actively seek improvement ideas."
      ],
      [
       "Get it right for customers the first time, every time, then work to exceed their expectations.",
       "Track industry trends and competitor moves, locally and internationally.",
       "Recognise and celebrate improvements that save time, however small.",
       "Never let a day pass without asking at least one customer what they want."
      ]
     ]
    },
    {
     "label": "Priorities the team or organisation can set",
     "values": [
      [
       "Driving superior return on investment.",
       "Focusing on a few quantifiable objectives.",
       "Rewarding high performance distinctly.",
       "Managing the project portfolio for value.",
       "Growth through acquisition or partnership."
      ],
      [
       "Deploying small, elite troubleshooting teams.",
       "Quickly stopping under-performing initiatives.",
       "Confronting problems as soon as they appear.",
       "Making real-time decisions.",
       "Driving through barriers."
      ]
     ]
    },
    {
     "label": "HR and system levers (Setup Section H)",
     "values": [
      [
       "Performance management: cascade clear targets through measurable objectives on the strategic scorecard, with a quarterly review rhythm.",
       "Promotion: base promotion on delivered, measurable results.",
       "Reward: link variable pay to a small number of measurable outcomes.",
       "Onboarding: set clear performance expectations in the first week."
      ]
     ]
    },
    {
     "label": "Visible signal within 30 days (Check C3)",
     "values": [
      [
       "Within 30 days, publish a simple team scoreboard and publicly recognise a delivery win against it."
      ]
     ]
    },
    {
     "label": "CDP re-measurement watch-list",
     "values": [
      [
       "D2 S1, S3 · D3 S3 · D5 S1 · D6 S1–S3 · eOS Q8 (and D8, to guard against burnout)"
      ]
     ]
    }
   ]
  }
 },
 "GOVERN": {
  "tagline": "Systems + Order · inward focus + structured · “We do things right”",
  "intro": "GOVERN describes a system of order in which clear structures, defined processes and consistent standards shape daily experience. Reporting lines and expectations are well documented, risk is actively managed, and the organisation values precision, reliability and compliance.",
  "profile": [
   {
    "attribute": "Core focus",
    "specification": [
     "Systems + Order"
    ]
   },
   {
    "attribute": "Values",
    "specification": [
     "Reliability · consistent standards · efficient processes · clear controls · dependable delivery"
    ]
   },
   {
    "attribute": "Leader type",
    "specification": [
     "Standardises · coordinates · safeguards quality"
    ]
   },
   {
    "attribute": "How it creates value",
    "specification": [
     "Value is created through reliable, efficient processes and consistent standards."
    ]
   },
   {
    "attribute": "Strengths when anchored here",
    "specification": [
     "Incremental improvements occur frequently.",
     "High quality and consistency drive success.",
     "The organisation plans for the long term."
    ]
   },
   {
    "attribute": "Overplay risks (drawbacks at the extreme)",
    "specification": [
     "Structure hardens into bureaucracy.",
     "Radical ideas are suppressed.",
     "Goals and metrics become ends in themselves."
    ]
   },
   {
    "attribute": "Relationship to other orientations",
    "specification": [
     "Complements ENGAGE and PERFORM. Contrasts (diagonally) with INNOVATE."
    ]
   },
   {
    "attribute": "Where it shows in CDP results",
    "specification": [
     "High GOVERN allocation in D1 Scenarios 2 and 3, D3 Scenario 1 (management philosophy), D5 Scenario 2 (resource allocation logic) and D6 Scenario 3 (measurement philosophy). Cross-check the D9 score and Section H process bottlenecks."
    ]
   }
  ],
  "matrix": {
   "note": "Used exactly as described at 11.7.2.",
   "columns": [
    "If you (leader) are GOVERN",
    "If your team is GOVERN",
    "If your department / unit is GOVERN",
    "If your organisation is GOVERN"
   ],
   "rows": [
    {
     "label": "On its own, value comes from…",
     "cells": [
      "Your attention to detail and ability to spot incremental improvement opportunities.",
      "Making long-term reliability and consistency part of the team’s standard practice.",
      "Connecting practices, processes and systems to growth objectives.",
      "Identifying growth projects through careful, ongoing evaluation of practices and processes."
     ]
    },
    {
     "label": "And you work with, or must build, ENGAGE (complement)…",
     "cells": [
      "Works well when you jointly focus on learning to do things the right way.",
      "Creates value when good practice and standard ways of working are shared across teams.",
      "Succeeds when structured learning systems are built and shared.",
      "Builds value through long-term, trusted relationships that build sector-specific knowledge and practice."
     ]
    },
    {
     "label": "And you work with, or must build, PERFORM (complement)…",
     "cells": [
      "Works well when you share an interest in minimising a specific risk.",
      "Creates value around a specific shared goal that reduces risk and maximises return on investment.",
      "Succeeds through key projects with clear goals, timelines, responsibilities and outcomes.",
      "Builds value where joint ventures have clear objectives and resources, with a transactional, outcome focus."
     ]
    },
    {
     "label": "And you work with, or must build, INNOVATE (contrast: expect friction)…",
     "cells": [
      "Friction centres on risk: your caution may be seen as blocking ideas and progress. Keep concerns reasonable and look for ways to turn them into opportunities.",
      "Disagreements arise over novelty versus feasibility. Use your expertise to help them build a proof of concept and accept that some failure is normal at this stage.",
      "Conflicting views on how to pursue growth. Recognise that some risk is necessary for growth and find common ground where reasonable risk carries meaningful upside.",
      "Formal macro-level partnerships may not work. Use consulting, solutions-based or technology-transfer arrangements to access their ideas."
     ]
    }
   ]
  },
  "metrics": {
   "columns": [
    "Efficiency",
    "Consistency & Compliance"
   ],
   "rows": [
    {
     "label": "Headline performance metric",
     "values": [
      [
       "Asset turnover: revenue divided by total assets in a given year."
      ],
      [
       "First-time-right rate and compliance record (audit findings, regulatory breaches), with gross margin as a supporting measure for commercial entities."
      ]
     ]
    },
    {
     "label": "Supporting indicators",
     "values": [
      [
       "Unit cost; cost against target.",
       "Actual against planned output.",
       "Inventory days and % of back-orders.",
       "% of milestones achieved.",
       "% of on-time deliveries.",
       "Interest and financing cost savings.",
       "Labour productivity variance; throughput time."
      ],
      [
       "First-time quality %; scrap and rework %.",
       "Safety incidents and violations.",
       "Service or product failures by line.",
       "Improvement in error or defect rates.",
       "% reduction in redundancy or waste.",
       "Changes required after release; % of certified suppliers.",
       "Warranty claims, complaints, and audit and compliance findings."
      ]
     ]
    },
    {
     "label": "To achieve Efficiency / Consistency & Compliance, nurture…",
     "values": [
      [
       "Cost control",
       "Regulation and policy",
       "Monitoring",
       "Improvement",
       "Stability"
      ],
      [
       "Reliability",
       "On-time delivery",
       "Process improvement",
       "Technical capability",
       "Systems and technology"
      ]
     ]
    },
    {
     "label": "Cultures strong here are characterised by…",
     "values": [
      [
       "Structure",
       "Rules and policies",
       "Risk aversion",
       "Cost control",
       "Functional specialisation",
       "Preservation of order"
      ],
      [
       "Improvement focus",
       "Technology emphasis",
       "Best practice",
       "Workflow management",
       "Data focus",
       "Best-in-class ambition"
      ]
     ]
    },
    {
     "label": "Leaders who build it tend to be…",
     "values": [
      [
       "Administrator",
       "Standardising",
       "Diligent",
       "Conserves resources",
       "Technologically adept"
      ],
      [
       "Engineer",
       "Systems thinker",
       "Dependable and reliable",
       "Technical expert"
      ]
     ]
    },
    {
     "label": "Leadership blind spot to avoid",
     "values": [
      [
       "Assuming laws, policies and procedures can be worked around. Have a system for double-checking adherence."
      ],
      [
       "Assuming an idea can be scaled without detail or planning. Pilot and model scaled ideas under different scenarios first."
      ]
     ]
    },
    {
     "label": "Culture blind spots (overplay)",
     "values": [
      [
       "Excessive control",
       "Stifling of ideas",
       "Distrust",
       "Neglect of people"
      ],
      [
       "Rigid predictability",
       "Micromanagement",
       "Neglect of people"
      ]
     ]
    },
    {
     "label": "Personal blind spots",
     "values": [
      [
       "Over-analyses",
       "Becomes “lean and mean”",
       "Ignores new ideas",
       "Weak social skills"
      ],
      [
       "Uses best practice as a crutch",
       "Informs but will not teach",
       "Weak social skills"
      ]
     ]
    },
    {
     "label": "Typical contexts",
     "values": [
      [
       "Manufacturing, operationally complex businesses, utilities, government and public sector bodies, regulated sectors (banking compliance, insurance, health), discount retail."
      ]
     ]
    }
   ]
  },
  "actions": {
   "when": "Applied when GOVERN is classified BUILD or STRENGTHEN, when it is the required orientation in a C1 or C4 miss, or when it is the target orientation in a C2 behaviour gap. These actions form the candidate library from which the engine drafts actions (8.2).",
   "columns": [
    "Efficiency",
    "Consistency & Compliance"
   ],
   "rows": [
    {
     "label": "Actions individuals and leaders can take",
     "values": [
      [
       "Use planning and HR / finance systems to forecast and monitor work.",
       "Measure processes and outcomes digitally.",
       "Break problems into smaller parts to understand the detail.",
       "Keep asking “why?” about unclear processes, and probe until they make sense."
      ],
      [
       "Measure improvement, not just task completion.",
       "Run regular reviews or audits of each unit to find improvements.",
       "Use past performance as the baseline for measuring progress.",
       "Critically review key reports for accuracy and usefulness."
      ]
     ]
    },
    {
     "label": "Priorities the team or organisation can set",
     "values": [
      [
       "Conserving financial resources.",
       "Implementing systems to control complex tasks.",
       "Making routine internal processes standard.",
       "Deploying technology at scale.",
       "Negotiating supplier cost reductions.",
       "Establishing clear roles and responsibilities."
      ],
      [
       "Applying quality-control systems to prevent costly mistakes.",
       "Complying with regulation.",
       "Adhering to professional standards.",
       "Using continuous-improvement processes."
      ]
     ]
    },
    {
     "label": "HR and system levers (Setup Section H)",
     "values": [
      [
       "Performance management: clarify roles (e.g. RACI) and include quality and compliance measures.",
       "Promotion: reward reliability, quality and sound judgement on risk.",
       "Reward: recognise error reduction and process improvements.",
       "Onboarding: run a structured induction to key procedures and standards."
      ]
     ]
    },
    {
     "label": "Visible signal within 30 days (Check C3)",
     "values": [
      [
       "Within 30 days, fix one visible process bottleneck that staff complain about, and communicate what changed."
      ]
     ]
    },
    {
     "label": "CDP re-measurement watch-list",
     "values": [
      [
       "D1 S2 · D3 S1 · D5 S2 · D6 S3 · D9 Adaptive Capacity · audit and compliance findings"
      ]
     ]
    }
   ]
  }
 }
};
