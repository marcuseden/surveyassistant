export const surveyQuestions = [
  {
    id: 'intro',
    text: "Hello, this is an automated research assistant calling to ask about your experiences with primary care. This survey will take about 5 minutes, and your responses will be anonymous. Your participation is voluntary, and you can stop at any time. To continue, please say \"Yes\" or press 1. To decline, say \"No\" or press 2.",
    type: 'intro',
    options: ['Yes', 'No'],
    followUp: null
  },
  {
    id: 'q1',
    text: "Do you have a primary care doctor you see regularly? Please say \"Yes,\" \"No,\" or \"I don't know.\"",
    type: 'choice',
    options: ['Yes', 'No', "I don't know"],
    followUp: {
      condition: 'No',
      question: "Can you tell me why not? For example, you don't need one, can't find one, or it's too expensive."
    }
  },
  {
    id: 'q2',
    text: "How do you usually contact your primary care doctor? Please say one: \"Phone,\" \"Online,\" \"In-person,\" \"Email,\" or \"Other.\"",
    type: 'choice',
    options: ['Phone', 'Online', 'In-person', 'Email', 'Other'],
    followUp: {
      condition: 'Other',
      question: "What other way do you use?"
    }
  },
  {
    id: 'q3',
    text: "How do you schedule appointments with your doctor? Please say one: \"Call the office,\" \"Online,\" \"Walk-in,\" or \"Other.\"",
    type: 'choice',
    options: ['Call the office', 'Online', 'Walk-in', 'Other'],
    followUp: {
      condition: '*',
      question: "On a scale of 1 to 5, where 1 is very easy and 5 is very difficult, how easy is it to schedule an appointment? Please say a number from 1 to 5."
    }
  },
  {
    id: 'q4',
    text: "How long does it usually take to get an appointment? Please say one: \"Same day,\" \"1 to 3 days,\" \"1 to 2 weeks,\" \"1 month or more,\" or \"I can't get one.\"",
    type: 'choice',
    options: ['Same day', '1 to 3 days', '1 to 2 weeks', '1 month or more', "I can't get one"],
    followUp: null
  },
  {
    id: 'q5',
    text: "Have you used telehealth to connect with a doctor in the past year? Please say \"Yes\" or \"No.\"",
    type: 'choice',
    options: ['Yes', 'No'],
    followUp: {
      condition: 'Yes',
      question: "On a scale of 1 to 5, where 1 is poor and 5 is excellent, how was your telehealth experience? Please say a number from 1 to 5."
    }
  },
  {
    id: 'q6',
    text: "Have you ever had trouble contacting or seeing a primary care doctor? Please say \"Yes\" or \"No.\"",
    type: 'choice',
    options: ['Yes', 'No'],
    followUp: {
      condition: 'Yes',
      question: "Which challenges have you faced? You can say multiple options: \"Long wait times,\" \"Hard to contact office,\" \"No doctors available,\" \"Cost,\" \"Transportation,\" \"Language barriers,\" \"Technology issues,\" or \"Other.\""
    }
  },
  {
    id: 'q7',
    text: "What is the biggest barrier to accessing primary care for you? Please describe in a few words.",
    type: 'open',
    options: [],
    followUp: null
  },
  {
    id: 'q8',
    text: "Have you ever avoided seeking primary care because of these challenges? Please say \"Yes\" or \"No.\"",
    type: 'choice',
    options: ['Yes', 'No'],
    followUp: {
      condition: 'Yes',
      question: "What did you do instead? For example, went to the emergency room, treated yourself, or ignored the issue."
    }
  },
  {
    id: 'q9',
    text: "How have challenges accessing primary care affected your health? Please say one: \"No impact,\" \"Minor impact,\" \"Moderate impact,\" or \"Severe impact.\"",
    type: 'choice',
    options: ['No impact', 'Minor impact', 'Moderate impact', 'Severe impact'],
    followUp: {
      condition: '*',
      question: "Can you share an example, like an untreated condition getting worse?"
    }
  },
  {
    id: 'q10',
    text: "Have access issues ever caused you to miss work or hurt your job performance? Please say \"Yes\" or \"No.\"",
    type: 'choice',
    options: ['Yes', 'No'],
    followUp: {
      condition: 'Yes',
      question: "How did it affect your work? For example, took sick leave or lower productivity."
    }
  },
  {
    id: 'q11',
    text: "How have these challenges impacted your quality of life? Please say one: \"No impact,\" \"Minor impact,\" \"Moderate impact,\" or \"Severe impact.\"",
    type: 'choice',
    options: ['No impact', 'Minor impact', 'Moderate impact', 'Severe impact'],
    followUp: {
      condition: '*',
      question: "Can you describe how, like stress or mental health effects?"
    }
  },
  {
    id: 'q12',
    text: "Have you or a family member had a serious health issue due to delayed or no primary care? Please say \"Yes\" or \"No.\"",
    type: 'choice',
    options: ['Yes', 'No'],
    followUp: {
      condition: 'Yes',
      question: "If you're comfortable, please share what happened."
    }
  },
  {
    id: 'q13',
    text: "What is your age group? Please say one: \"18 to 24,\" \"25 to 34,\" \"35 to 44,\" \"45 to 54,\" \"55 to 64,\" or \"65 and older.\"",
    type: 'choice',
    options: ['18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 to 64', '65 and older'],
    followUp: null
  },
  {
    id: 'q14',
    text: "What is your insurance status? Please say one: \"Private insurance,\" \"Medicare,\" \"Medicaid,\" \"Uninsured,\" or \"Other.\"",
    type: 'choice',
    options: ['Private insurance', 'Medicare', 'Medicaid', 'Uninsured', 'Other'],
    followUp: null
  },
  {
    id: 'q15',
    text: "Where do you live? Please say one: \"Urban,\" \"Suburban,\" or \"Rural.\"",
    type: 'choice',
    options: ['Urban', 'Suburban', 'Rural'],
    followUp: null
  },
  {
    id: 'q16',
    text: "What is your household income? Please say one: \"Under 25,000,\" \"25,000 to 50,000,\" \"50,000 to 100,000,\" \"Over 100,000,\" or \"Prefer not to say.\"",
    type: 'choice',
    options: ['Under 25,000', '25,000 to 50,000', '50,000 to 100,000', 'Over 100,000', 'Prefer not to say'],
    followUp: null
  },
  {
    id: 'outro',
    text: "Thank you for participating in this survey. Your responses will help improve primary care access. Have a great day!",
    type: 'outro',
    options: [],
    followUp: null
  }
]; 