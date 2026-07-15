-- Allow testimonial letter as a document type on transcript requests

ALTER TABLE school_website_transcript_requests
  DROP CONSTRAINT IF EXISTS school_website_transcript_requests_document_type_check;

ALTER TABLE school_website_transcript_requests
  ADD CONSTRAINT school_website_transcript_requests_document_type_check
  CHECK (document_type IN ('transcript', 'bece', 'both', 'testimonial'));
