const crypto = require('crypto');
const { SECURITY } = require('../config/constants');

class SecurityUtil {
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  static hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove any null bytes
    input = input.replace(/\0/g, '');
    
    // Remove any control characters
    input = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Escape HTML entities
    input = input.replace(/[&<>"]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return m;
    });
    
    return input.trim();
  }

  static detectSuspiciousInput(input) {
    const suspiciousPatterns = [
      /'.*OR.*'/i,
      /'.*UNION.*'/i,
      /;.*DROP/i,
      /;.*DELETE/i,
      /;.*UPDATE/i,
      /--/,
      /\/\*.*\*\//,
      /<script/i,
      /javascript:/i,
      /onerror/i,
      /onload/i
    ];

    const stringInput = JSON.stringify(input);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(stringInput)) {
        return true;
      }
    }
    
    return false;
  }

  static maskEmail(email) {
    const [local, domain] = email.split('@');
    const maskedLocal = local.slice(0, 2) + '*'.repeat(local.length - 2);
    return `${maskedLocal}@${domain}`;
  }
}

module.exports = SecurityUtil;