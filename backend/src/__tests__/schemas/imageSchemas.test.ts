import { imageSchemas } from '../../schemas/imageSchemas';

describe('imageSchemas', () => {
  describe('fileNameParam', () => {
    describe('valid filenames', () => {
      it('should accept simple filename with extension', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'image.png' });
        expect(result.error).toBeUndefined();
        expect(result.value.fileName).toBe('image.png');
      });

      it('should accept filename with hyphens and underscores', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'my-image_file.jpg' });
        expect(result.error).toBeUndefined();
        expect(result.value.fileName).toBe('my-image_file.jpg');
      });

      it('should accept filename with multiple dots in extension', () => {
        const result = imageSchemas.fileNameParam.validate({
          fileName: 'archive.tar.gz',
        });
        expect(result.error).toBeUndefined();
        expect(result.value.fileName).toBe('archive.tar.gz');
      });

      it('should accept filename with numbers', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'image123.png' });
        expect(result.error).toBeUndefined();
        expect(result.value.fileName).toBe('image123.png');
      });
    });

    describe('path traversal prevention', () => {
      it('should reject filename with forward slash', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'path/to/image.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject filename with backslash', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'path\\to\\image.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject filename with double dots at start', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '../secrets.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject filename with double dots in middle', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'a/../b.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject filename with double dots at end', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'image...png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject Windows-style path traversal', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '..\\secrets.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject mixed path separators', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '../path\\file.png' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });

      it('should reject absolute path', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '/etc/passwd' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'fileName must be a basename only (no path separators or .. segments)'
        );
      });
    });

    describe('validation rules', () => {
      it('should reject empty filename', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('is not allowed to be empty');
      });

      it('should reject filename without extension', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: 'image' });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('valid filename');
      });

      it('should reject filename exceeding max length', () => {
        const longName = 'a'.repeat(510) + '.png';
        const result = imageSchemas.fileNameParam.validate({ fileName: longName });
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('must be less than or equal to 512');
      });

      it('should trim whitespace', () => {
        const result = imageSchemas.fileNameParam.validate({ fileName: '  image.png  ' });
        expect(result.error).toBeUndefined();
        expect(result.value.fileName).toBe('image.png');
      });

      it('should require fileName field', () => {
        const result = imageSchemas.fileNameParam.validate({});
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('fileName');
        expect(result.error?.message).toContain('required');
      });
    });
  });
});
