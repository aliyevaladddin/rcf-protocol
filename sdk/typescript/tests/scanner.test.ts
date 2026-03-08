import { ComplianceValidator } from '../src/core/ComplianceValidator';
import { ParseResult } from '../src/core/types';

describe('ComplianceValidator', () => {
    it('should identify PROTECTED files without headers and add warnings (non-strict)', async () => {
        const validator = new ComplianceValidator({ strict: false });

        // Simulate a ParseResult from MarkerParser
        const mockResults: ParseResult[] = [
            {
                file: 'src/protected.ts',
                markers: [
                    { type: 'PROTECTED', marker: { name: '[RCF:PROTECTED]', level: 1, description: 'desc' }, line: 2, column: 0, context: '' }
                ]
            }
        ];

        const validation = await validator.validate(mockResults);

        // In non-strict mode, missing NOTICE trigger a warning 
        expect(validation.errors.length).toBe(0);
        expect(validation.warnings.length).toBe(1);
        expect(validation.warnings[0].message).toContain('File contains PROTECTED/RESTRICTED markers but no [RCF:NOTICE]');
    });

    it('should identify PROTECTED files without headers and add errors (strict)', async () => {
        const validator = new ComplianceValidator({ strict: true });

        const mockResults: ParseResult[] = [
            {
                file: 'src/protected.ts',
                markers: [
                    { type: 'PROTECTED', marker: { name: '[RCF:PROTECTED]', level: 1, description: 'desc' }, line: 2, column: 0, context: '' }
                ]
            }
        ];

        const validation = await validator.validate(mockResults);

        // In strict mode, missing NOTICE triggers an error
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBe(1);
        expect(validation.warnings.length).toBe(0);
    });

    it('should parse PUBLIC files correctly and track headers', async () => {
        const validator = new ComplianceValidator({ strict: true });

        const mockResults: ParseResult[] = [
            {
                file: 'src/public.ts',
                markers: [
                    { type: 'NOTICE', marker: { name: '[RCF:NOTICE]', level: 'meta', description: 'desc' }, line: 1, column: 0, context: '' },
                    { type: 'PUBLIC', marker: { name: '[RCF:PUBLIC]', level: 0, description: 'desc' }, line: 2, column: 0, context: '' }
                ]
            }
        ];

        const validation = await validator.validate(mockResults);

        // Valid because NOTICE is present
        expect(validation.valid).toBe(true);
        expect(validation.errors.length).toBe(0);
        expect(validation.warnings.length).toBe(0);
    });
});
