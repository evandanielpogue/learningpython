import type { Template } from '../types';

/** The stock message templates every workspace starts with. */
export const TEMPLATES: Template[] = [
  {
    id: 'tpl_peer', name: 'Ask a peer what it is really like', persona: 'Peer', stage: 'First touch', channel: 'LinkedIn', stock: true,
    body: "{first}, I applied for the {role} and figured I would go to the source rather than the portal.\n\nCurious what changed day to day when {company} moved upmarket. Longer cycles, or just more people in the room?\n\nEither way, appreciate you reading this.",
  },
  {
    id: 'tpl_rec', name: 'Check the req is actually moving', persona: 'Recruiter', stage: 'First touch', channel: 'Email', stock: true,
    body: "{first}, I applied for the {role} on Tuesday. Quick context: {win}.\n\nIs the team still interviewing for this one, or is it further along than the posting suggests?",
  },
  {
    id: 'tpl_hm', name: 'Open with what you noticed', persona: 'Hiring manager', stage: 'First touch', channel: 'Email', stock: true,
    body: "{first}, {angle}\n\n{win}. [One sentence on what that actually took — the part a résumé bullet leaves out.]\n\nI applied for the {role}.\n\nWorth fifteen minutes, or should I stay in the queue?",
  },
  {
    id: 'tpl_hm2', name: 'Follow up with something new', persona: 'Hiring manager', stage: 'Follow up', channel: 'Email', stock: true,
    body: "{first}, [something you went and found out about {company} since you last wrote — a number, a friction, a thing they said].\n\n[Why it matters to the thing this role owns.]\n\nStill happy to trade fifteen minutes if useful.",
  },
  {
    id: 'tpl_exec', name: 'Go one level up', persona: 'Skip level', stage: 'Escalation', channel: 'Email', stock: true,
    body: "{first}, {angle}\n\n{win}.\n\nApplied for the {role}.\n\nWorth passing down, or should I sit tight?",
  },
  {
    id: 'tpl_tie', name: 'Ask for the intro and write it for them', persona: 'Shared tie', stage: 'Referral ask', channel: 'LinkedIn', stock: true,
    body: "{first}, [where the two of you overlapped, and when].\n\nI am going after the {role} at {company}. If you are still in touch with anyone there, would you be up for forwarding me along? Totally fine if that bridge is not one you want to cross.\n\nSomething you could paste:\n\"{me} {win}. He has applied for the {role}.\"",
  },
  {
    id: 'tpl_ref', name: 'Ask a peer to refer you', persona: 'Peer', stage: 'Referral ask', channel: 'Reply', stock: true,
    body: "{first}, [the specific thing they told you] was the most useful thing anyone has said to me about this role.\n\nIf it feels right after one conversation, would you be open to dropping me in the referral portal? No pressure at all.",
  },
  {
    id: 'tpl_call', name: 'Phone script for the recruiter', persona: 'Recruiter', stage: 'Follow up', channel: 'Call', stock: true,
    body: "Hi {first}, it is {me}. I applied for the {role} a couple of weeks back. Is now a bad time?\n\n[pause, actually wait]\n\nQuick one. I wanted to check whether that req is still moving or whether it is on hold. I would rather know than keep guessing.",
  },
  {
    id: 'tpl_break', name: 'Close the loop and leave the door open', persona: 'Other', stage: 'Breakup', channel: 'Email', stock: true,
    body: "{first}, closing the loop on this one so I am not cluttering your inbox.\n\nUnrelated to the role, the integrations-before-security thing is worth handing to whoever owns your discovery script. Cheap fix.\n\nIf the seat opens up again I would still want the conversation. Good luck with the quarter.",
  },
];
