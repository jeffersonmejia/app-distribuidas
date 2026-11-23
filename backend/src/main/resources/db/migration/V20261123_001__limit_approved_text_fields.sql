-- NOT VALID conserva las filas heredadas y exige los límites en nuevas escrituras.
ALTER TABLE crm_customer ADD CONSTRAINT crm_customer_full_name_max CHECK (char_length(full_name) <= 200) NOT VALID;
ALTER TABLE projects_project ADD CONSTRAINT projects_project_name_max CHECK (char_length(name) <= 150) NOT VALID;
ALTER TABLE projects_project ADD CONSTRAINT projects_project_description_max CHECK (char_length(description) <= 2000) NOT VALID;
ALTER TABLE projects_task ADD CONSTRAINT projects_task_title_max CHECK (char_length(title) <= 200) NOT VALID;
ALTER TABLE marketing_campaign ADD CONSTRAINT marketing_campaign_name_max CHECK (char_length(name) <= 150) NOT VALID;
ALTER TABLE marketing_campaign ADD CONSTRAINT marketing_campaign_description_max CHECK (char_length(description) <= 2000) NOT VALID;
ALTER TABLE marketing_template ADD CONSTRAINT marketing_template_html_body_max CHECK (char_length(html_body) <= 100000) NOT VALID;
ALTER TABLE marketing_template ADD CONSTRAINT marketing_template_text_body_max CHECK (char_length(text_body) <= 50000) NOT VALID;
