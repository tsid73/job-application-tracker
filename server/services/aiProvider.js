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
  async generateCV({ jobDescription, cv }) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: [
        'Tailored CV draft',
        '',
        `Source CV: ${cv.original_name}`,
        '',
        'Relevant CV text:',
        summarize(cv.extracted_text || ''),
        '',
        'Emphasize these role-specific points:',
        summarize(jobDescription)
      ].join('\n')
    };
  }

  async generateCoverLetter({ jobDescription, cv }) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: [
        'Dear hiring team,',
        '',
        `I am applying for this role and have aligned my experience from ${cv.original_name} to the requirements below.`,
        '',
        'Relevant background:',
        summarize(cv.extracted_text || ''),
        '',
        summarize(jobDescription),
        '',
        'Sincerely,'
      ].join('\n')
    };
  }

  async scoreRoleFit({ jobDescription, cv }) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: [
        'Role fit score: 72/100',
        '',
        'Missing skills:',
        '- Add exact framework names from the job description if you have them.',
        '- Add recent measurable outcomes.',
        '',
        'Keyword suggestions:',
        '- PostgreSQL',
        '- Node.js',
        '- API design',
        '- Operational tooling',
        '',
        'Basis:',
        summarize(`${jobDescription}\n\n${cv.extracted_text || ''}`)
      ].join('\n')
    };
  }

  async generateFollowUpEmail({ jobDescription, cv }) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: [
        'Subject: Follow-up on my application',
        '',
        'Hello,',
        '',
        'I wanted to follow up on my application. I remain interested in the role and believe my background is aligned with the needs described in the posting.',
        '',
        summarize(jobDescription),
        '',
        'Thank you for your time,',
        '[Your Name]'
      ].join('\n')
    };
  }

  async checkATS({ jobDescription, cv }) {
    return {
      provider: 'mock',
      model: 'mock-local-model',
      content: [
        'ATS score: 78/100',
        '',
        'Match summary:',
        '- Core backend and API terms overlap with the role.',
        '- Quantified outcomes are limited and should be expanded.',
        '- Several exact keywords from the posting are missing.',
        '',
        'Missing keywords:',
        '- REST APIs',
        '- CI/CD',
        '- monitoring',
        '- TypeScript',
        '',
        'Suggested CV changes:',
        '- Add an exact skills section using the job description language.',
        '- Add 3 to 5 measurable impact bullets.',
        '- Move the most relevant stack terms into the top third of the CV.',
        '',
        'Basis:',
        summarize(`${jobDescription}\n\n${cv.extracted_text || ''}`)
      ].join('\n')
    };
  }
}

class OpenAICompatibleProvider extends AIProvider {
  async generateCV({ jobDescription, cv }) {
    return this.chat(buildPrompt({
      instruction: 'Rewrite the CV for the target role.',
      format: [
        'Return plain text only.',
        'Use these sections in order: Headline, Summary, Core Skills, Experience Highlights, Suggested Keyword Additions.',
        'Keep the wording editable and concise.',
        'Do not invent employers or achievements.'
      ],
      cv,
      jobDescription
    }));
  }

  async generateCoverLetter({ jobDescription, cv }) {
    return this.chat(buildPrompt({
      instruction: 'Write a concise, strong cover letter for the target role.',
      format: [
        'Return plain text only.',
        'Use these sections in order: Opening, Why I Fit, Evidence, Closing.',
        'Keep it under 350 words.',
        'Make the content specific to the role and resume details provided.',
        'Do not use placeholders except [Your Name] if needed.'
      ],
      cv,
      jobDescription
    }));
  }

  async scoreRoleFit({ jobDescription, cv }) {
    return this.chat(buildPrompt({
      instruction: 'Evaluate the candidate fit for the role.',
      format: [
        'Return plain text only.',
        'Use these sections in order: Score, Match Summary, Missing Skills, Keyword Suggestions, CV Improvements.',
        'Score must be a number from 0 to 100.',
        'Keep every section concise and actionable.'
      ],
      cv,
      jobDescription
    }));
  }

  async generateFollowUpEmail({ jobDescription, cv }) {
    return this.chat(buildPrompt({
      instruction: 'Write a concise follow-up email for this job application.',
      format: [
        'Return plain text only.',
        'Use these sections in order: Subject, Greeting, Follow-up Message, Close.',
        'Keep it under 180 words.',
        'Make it specific, professional, and easy to edit.'
      ],
      cv,
      jobDescription
    }));
  }

  async checkATS({ jobDescription, cv }) {
    return this.chat(buildPrompt({
      instruction: 'Act as an ATS reviewer for the target role.',
      format: [
        'Return plain text only.',
        'Use these sections in order: ATS Score, Match Summary, Missing Keywords, Matched Keywords, Weak Areas, Rewrite Suggestions.',
        'Score must be a number from 0 to 100.',
        'Keep the advice concrete and based only on the provided materials.'
      ],
      cv,
      jobDescription
    }));
  }

  async chat(prompt) {
    const response = await fetch(`${config.aiApiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.aiApiKey ? { authorization: `Bearer ${config.aiApiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = new Error(`AI provider failed with HTTP ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    const payload = await response.json();
    return {
      provider: 'openai-compatible',
      model: config.aiModel,
      content: payload.choices?.[0]?.message?.content || ''
    };
  }
}

export function createAIProvider(providerName = config.aiProvider) {
  if (providerName === 'openai-compatible' || providerName === 'gemini') return new OpenAICompatibleProvider();
  return new MockAIProvider();
}

function summarize(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No job description was provided.';
  return cleaned.length > 900 ? `${cleaned.slice(0, 900)}...` : cleaned;
}

function buildPrompt({ instruction, format, cv, jobDescription }) {
  return [
    instruction,
    ...format,
    `CV file selected: ${cv.original_name}`,
    `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
    `Job description:\n${jobDescription}`
  ].join('\n\n');
}
