-- Two fields the content model was missing.
--
-- experience.company_url: a role names an employer, and a reader who does not recognise the name
-- has nowhere to go. Nullable, because plenty of employers have no site worth linking, and
-- VARCHAR(500) with no format CHECK to match every other URL column in this schema
-- (project.github_url, certification.credential_url, research.external_url).
--
-- education.result: the GPA, CGPA, class or grade. Free text rather than a number, because
-- grading systems are not comparable — "3.85 / 4.00", "First Class" and "82%" are all the right
-- answer somewhere, and a NUMERIC column would force every one of them into a shape it does not
-- have.
ALTER TABLE experience ADD COLUMN company_url VARCHAR(500);
ALTER TABLE education ADD COLUMN result VARCHAR(50);
