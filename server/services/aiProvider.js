import { config } from '../config.js';

export class AIProvider {
  async generateCV() {
    throw new Error('generateCV is not implemented');
  }

  async generateCoverLetter() {
    throw new Error('generateCoverLetter is not implemented');
  }

  async scoreRoleFit() {
    throw new Error('scoreRoleFit is not implemented');
  }

  async generateFollowUpEmail() {
    throw new Error('generateFollowUpEmail is not implemented');
  }

  async checkATS() {
    throw new Error('checkATS is not implemented');
  }
}

class MockAIProvider extends AIProvider {
  async generateCV(input) {
    const prompt = buildGenerationPrompt('tailored_cv', input);
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: normalizeGeneratedContent([
        'Headline',
        conciseLine(input.application?.role_title || 'Tailored CV'),
        '',
        'Summary',
        `Tailored for ${input.application?.company_name || 'the target company'} using verified experience from ${input.cv.original_name}.`,
        '',
        'Core Skills',
        ...toBullets(input.candidateSignals?.technologies?.slice(0, 8) || []),
        '',
        'Experience Highlights',
        ...toBullets(input.candidateSignals?.evidence?.slice(0, 5) || [summarize(prompt.userPrompt, 220)]),
        '',
        'Suggested Keyword Additions',
        ...toBullets(input.jobSignals?.keywords?.slice(0, 8) || [])
      ].join('\n'))
    };
  }

  async generateCoverLetter(input) {
    const prompt = buildGenerationPrompt('cover_letter', input);
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: normalizeGeneratedContent([
        'Opening',
        `Dear hiring team, I am applying for the ${input.application?.role_title || 'role'} position at ${input.application?.company_name || 'your company'}.`,
        '',
        'Why I Fit',
        summarize(prompt.contextBlock, 260),
        '',
        'Evidence',
        ...toBullets(input.candidateSignals?.evidence?.slice(0, 3) || []),
        '',
        'Closing',
        'Thank you for your time and consideration.',
        '[Your Name]'
      ].join('\n'))
    };
  }

  async scoreRoleFit(input) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: normalizeGeneratedContent([
        'Score',
        '72/100',
        '',
        'Match Summary',
        summarize(buildContextBlock(input), 240),
        '',
        'Missing Skills',
        ...toBullets(input.jobSignals?.requirements?.slice(0, 4) || ['Add more exact role-aligned skills from the job description.']),
        '',
        'Keyword Suggestions',
        ...toBullets(input.jobSignals?.keywords?.slice(0, 6) || []),
        '',
        'CV Improvements',
        '- Add more measurable outcomes near the top of the resume.',
        '- Reuse exact role terminology where experience supports it.'
      ].join('\n'))
    };
  }

  async generateFollowUpEmail(input) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: normalizeGeneratedContent([
        'Subject',
        `Follow-up on ${input.application?.role_title || 'my application'}${input.application?.company_name ? ` - ${input.application.company_name}` : ''}`,
        '',
        'Greeting',
        'Hello,',
        '',
        'Follow-up Message',
        `I wanted to follow up on my application for the ${input.application?.role_title || 'role'}. My background aligns with the priorities in the posting, especially ${input.jobSignals?.keywords?.slice(0, 3).join(', ') || 'the core requirements'}.`,
        '',
        'Close',
        'Thank you for your time,',
        '[Your Name]'
      ].join('\n'))
    };
  }

  async checkATS(input) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: normalizeGeneratedContent([
        'ATS Score',
        '78/100',
        '',
        'Match Summary',
        summarize(buildContextBlock(input), 220),
        '',
        'Missing Keywords',
        ...toBullets(input.jobSignals?.keywords?.slice(0, 6) || []),
        '',
        'Matched Keywords',
        ...toBullets(intersectValues(input.jobSignals?.keywords || [], input.candidateSignals?.technologies || []).slice(0, 6)),
        '',
        'Weak Areas',
        '- Quantified outcomes could be stronger.',
        '- Top-third keyword density can improve.',
        '',
        'Rewrite Suggestions',
        '- Move the strongest role-aligned technologies higher in the CV.',
        '- Add measurable impact bullets where evidence exists.'
      ].join('\n'))
    };
  }
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const OLLAMA_BASE_URL = 'http://localhost:11434/v1';

class OpenAICompatibleProvider extends AIProvider {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  async generateCV(input) {
    return this.chat(buildGenerationPrompt('tailored_cv', input));
  }

  async generateCoverLetter(input) {
    return this.chat(buildGenerationPrompt('cover_letter', input));
  }

  async scoreRoleFit(input) {
    return this.chat(buildGenerationPrompt('role_fit', input));
  }

  async generateFollowUpEmail(input) {
    return this.chat(buildGenerationPrompt('follow_up_email', input));
  }

  async checkATS(input) {
    return this.chat(buildGenerationPrompt('ats_check', input));
  }

  async chat(prompt) {
    if (!config.aiApiKey) {
      const error = new Error('AI API key is missing. Set AI_API_KEY in your .env file.');
      error.statusCode = 400;
      throw error;
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const detail = payload?.error?.message || payload?.error || '';
      const error = new Error(detail || `AI provider failed with HTTP ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    const payload = await response.json();
    return {
      provider: 'openai-compatible',
      model: config.aiModel,
      content: normalizeGeneratedContent(payload.choices?.[0]?.message?.content || '')
    };
  }
}

export function createAIProvider(providerName = config.aiProvider) {
  if (providerName === 'openai-compatible' || providerName === 'gemini') {
    // Respect explicit AI_API_BASE_URL if set; otherwise derive from the requested provider.
    const baseUrl = process.env.AI_API_BASE_URL ||
      (providerName === 'gemini' ? GEMINI_BASE_URL : OLLAMA_BASE_URL);
    return new OpenAICompatibleProvider(baseUrl);
  }
  return new MockAIProvider();
}

function buildGenerationPrompt(type, input) {
  const specification = documentSpecifications[type];
  const contextBlock = buildContextBlock(input);
  return {
    systemPrompt: [
      'You are a job-application writing assistant.',
      'Write concise, professional, editable plain text.',
      'Use only evidence supported by the provided CV context.',
      'Do not invent employers, projects, dates, metrics, or tools.',
      'If evidence is weak, write carefully and avoid unsupported claims.',
      'Avoid generic filler such as "I am excited to apply" unless directly justified.',
      'Follow the requested section order exactly.',
      'Return plain text only with clean headings and bullets.'
    ].join(' '),
    contextBlock,
    userPrompt: [
      specification.goal,
      specification.rules.join('\n'),
      '',
      contextBlock,
      '',
      `Output sections in this order:\n${specification.sections.join('\n')}`
    ].join('\n')
  };
}

const documentSpecifications = {
  tailored_cv: {
    goal: 'Rewrite the resume for the target role using verified experience only.',
    sections: ['Headline', 'Summary', 'Core Skills', 'Experience Highlights', 'Suggested Keyword Additions'],
    rules: [
      '- Keep every section concise and editable.',
      '- Emphasize role-matching strengths first.',
      '- Use bullets where useful.',
      '- Do not fabricate achievements.'
    ]
  },
  cover_letter: {
    goal: 'Write a concise, role-specific cover letter using only supported experience.',
    sections: ['Opening', 'Why I Fit', 'Evidence', 'Closing'],
    rules: [
      '- Stay under 320 words.',
      '- Avoid generic openings and empty enthusiasm.',
      '- Make claims only when supported by candidate evidence.',
      '- Use natural plain text, not markdown.'
    ]
  },
  role_fit: {
    goal: 'Evaluate candidate fit for the role using the provided resume and job description.',
    sections: ['Score', 'Match Summary', 'Missing Skills', 'Keyword Suggestions', 'CV Improvements'],
    rules: [
      '- Score must be 0 to 100.',
      '- Keep each section operational and concise.',
      '- Distinguish strengths from gaps clearly.'
    ]
  },
  follow_up_email: {
    goal: 'Write a short professional follow-up email for the application.',
    sections: ['Subject', 'Greeting', 'Follow-up Message', 'Close'],
    rules: [
      '- Stay under 170 words.',
      '- Keep the tone direct, polite, and easy to edit.',
      '- Do not overstate fit.'
    ]
  },
  ats_check: {
    goal: 'Review the resume against the target role as an ATS-oriented reviewer.',
    sections: ['ATS Score', 'Match Summary', 'Missing Keywords', 'Matched Keywords', 'Weak Areas', 'Rewrite Suggestions'],
    rules: [
      '- Score must be 0 to 100.',
      '- Focus on exact role language and resume evidence.',
      '- Keep rewrite suggestions specific.'
    ]
  }
};

function buildContextBlock(input) {
  return [
    `Target company: ${input.application?.company_name || 'Unknown'}`,
    `Target role: ${input.application?.role_title || 'Unknown'}`,
    `CV file: ${input.cv.original_name}`,
    '',
    'Job summary:',
    input.jobSignals?.summary || summarize(input.jobDescription, 700),
    '',
    'Top responsibilities:',
    ...toBullets(input.jobSignals?.responsibilities?.slice(0, 6) || []),
    '',
    'Key requirements:',
    ...toBullets(input.jobSignals?.requirements?.slice(0, 6) || []),
    '',
    'Important job keywords:',
    ...toBullets(input.jobSignals?.keywords?.slice(0, 10) || []),
    '',
    'Candidate summary:',
    input.candidateSignals?.summary || summarize(input.cv.extracted_text || '', 700),
    '',
    'Strong candidate evidence:',
    ...toBullets(input.candidateSignals?.evidence?.slice(0, 6) || []),
    '',
    'Candidate technologies:',
    ...toBullets(input.candidateSignals?.technologies?.slice(0, 10) || [])
  ].join('\n');
}

function normalizeGeneratedContent(content) {
  return String(content || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return '';
  if (/^(headline|summary|core skills|experience highlights|suggested keyword additions|opening|why i fit|evidence|closing|score|match summary|missing skills|keyword suggestions|cv improvements|subject|greeting|follow-up message|close|ats score|missing keywords|matched keywords|weak areas|rewrite suggestions)$/i.test(trimmed)) {
    return trimmed.replace(/:$/, '');
  }
  if (/^[*-]\s*/.test(trimmed)) return `- ${trimmed.replace(/^[*-]\s*/, '')}`;
  return trimmed;
}

function conciseLine(value) {
  return summarize(value, 120);
}

function summarize(text, limit = 900) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Not available.';
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1).trim()}…` : cleaned;
}

function toBullets(values) {
  if (!values.length) return ['- Not available.'];
  return values.map((value) => `- ${String(value || '').replace(/\s+/g, ' ').trim()}`);
}

function intersectValues(left, right) {
  const rightSet = new Set(right.map((value) => String(value).toLowerCase()));
  return left.filter((value) => rightSet.has(String(value).toLowerCase()));
}
