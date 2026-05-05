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
    return this.chat([
      'Rewrite the CV for the target role. Return concise, editable plain text.',
      `CV file selected: ${cv.original_name}`,
      `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
      `Job description:\n${jobDescription}`
    ].join('\n\n'));
  }

  async generateCoverLetter({ jobDescription, cv }) {
    return this.chat([
      'Write a concise cover letter for the target role. Return plain text only.',
      `CV file selected: ${cv.original_name}`,
      `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
      `Job description:\n${jobDescription}`
    ].join('\n\n'));
  }

  async scoreRoleFit({ jobDescription, cv }) {
    return this.chat([
      'Score this candidate fit for the role from 0 to 100. Then list missing skills, keyword suggestions, and concrete CV improvements. Return concise plain text.',
      `CV file selected: ${cv.original_name}`,
      `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
      `Job description:\n${jobDescription}`
    ].join('\n\n'));
  }

  async generateFollowUpEmail({ jobDescription, cv }) {
    return this.chat([
      'Write a concise follow-up email for this job application. Return subject and body as editable plain text.',
      `CV file selected: ${cv.original_name}`,
      `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
      `Job description:\n${jobDescription}`
    ].join('\n\n'));
  }

  async checkATS({ jobDescription, cv }) {
    return this.chat([
      'Act as an ATS reviewer. Score this CV for the target role from 0 to 100.',
      'Then return these sections in plain text: ATS score, match summary, missing keywords, matched keywords, weak areas, and specific CV rewrite suggestions.',
      'Keep it concise, practical, and editable.',
      `CV file selected: ${cv.original_name}`,
      `Extracted CV text:\n${cv.extracted_text || 'No extracted CV text available.'}`,
      `Job description:\n${jobDescription}`
    ].join('\n\n'));
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

export function createAIProvider() {
  if (config.aiProvider === 'openai-compatible' || config.aiProvider === 'gemini') return new OpenAICompatibleProvider();
  return new MockAIProvider();
}

function summarize(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No job description was provided.';
  return cleaned.length > 900 ? `${cleaned.slice(0, 900)}...` : cleaned;
}
