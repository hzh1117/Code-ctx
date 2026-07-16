const { redactOutboundMessages } = require('../../src/ai/privacy-gateway');

describe('AI outbound privacy gateway', () => {
  test('redacts every message role and text content block without mutating input', () => {
    const messages = [
      { role: 'system', content: 'repo: /home/alice/private/project' },
      { role: 'user', content: 'api_key = "sk-user-secret" at C:\\Users\\alice\\project\\config.js' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'mongodb://admin:password@db.example.com/app' }]
      }
    ];
    const audits = [];

    const result = redactOutboundMessages(messages, audit => audits.push(audit));
    const serialized = JSON.stringify(result.messages);

    expect(serialized).not.toContain('/home/alice');
    expect(serialized).not.toContain('C:\\Users\\alice');
    expect(serialized).not.toContain('sk-user-secret');
    expect(serialized).not.toContain('admin:password');
    expect(messages[0].content).toContain('/home/alice');
    expect(audits).toEqual([result.audit]);
    expect(result.audit.totalRedactions).toBeGreaterThanOrEqual(4);
    expect(result.audit.messages.map(message => message.role)).toEqual(['system', 'user', 'assistant']);
    expect(JSON.stringify(result.audit)).not.toContain('alice');
    expect(JSON.stringify(result.audit)).not.toContain('sk-user-secret');
  });
});
