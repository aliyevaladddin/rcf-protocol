// NOTICE: This file is protected under RCF-PL v1.2.2
import { ParseResult, ValidationError } from './types';

interface ValidatorOptions {
  strict?: boolean;
}

/**
 * [RCF:RESTRICTED]
 * The ComplianceValidator class enforces strict adherence to RCF specification standards.
 */

export class ComplianceValidator {
  private strict: boolean;

  constructor(options: ValidatorOptions = {}) {
    this.strict = options.strict || false;
  }

  async validate(results: ParseResult[]): Promise<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const result of results) {
      const hasNotice = result.markers.some(m => m.type === 'NOTICE');
      const hasProtected = result.markers.some(m => m.type === 'PROTECTED');
      const hasRestricted = result.markers.some(m => m.type === 'RESTRICTED');

      if ((hasProtected || hasRestricted) && !hasNotice) {
        const msg = `File contains PROTECTED/RESTRICTED markers but no [RCF:NOTICE]`;
        if (this.strict) {
          errors.push({ file: result.file, line: 1, message: msg, severity: 'error' });
        } else {
          warnings.push({ file: result.file, line: 1, message: msg, severity: 'warning' });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}