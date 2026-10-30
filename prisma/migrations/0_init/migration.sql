-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProspectSegment" AS ENUM ('WARM_NETWORK', 'REFERRAL', 'AGENCY_EU', 'LUXURY_BRAND', 'LEGACY_COLD');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sales',
    "avatar_initials" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL DEFAULT 'CONCEPT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "testimonial_author" TEXT,
    "testimonial_consent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_translations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "tagline" TEXT,
    "meta_desc" TEXT,
    "client" TEXT,
    "industry" TEXT,
    "challenge" TEXT,
    "solution" TEXT,
    "step1_title" TEXT,
    "step1_desc" TEXT,
    "step2_title" TEXT,
    "step2_desc" TEXT,
    "step3_title" TEXT,
    "step3_desc" TEXT,
    "features" TEXT,
    "tech" TEXT,
    "result1_value" TEXT,
    "result1_label" TEXT,
    "result2_value" TEXT,
    "result2_label" TEXT,
    "result3_value" TEXT,
    "result3_label" TEXT,
    "results" TEXT,
    "testimonial" TEXT,
    "testimonial_role" TEXT,
    "testimonial_approved_at" TIMESTAMP(3),
    "testimonial_approved_by" TEXT,

    CONSTRAINT "project_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assigned_to_id" TEXT,
    "assigned_to_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp_link" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "has_website" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "whatsapp_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "instagram_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "quality_label" TEXT,
    "segment" "ProspectSegment" NOT NULL DEFAULT 'LEGACY_COLD',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'A_ENVOYER',
    "sent_at" TIMESTAMP(3),
    "follow_up_date" TIMESTAMP(3),
    "followup_1_at" TIMESTAMP(3),
    "followup_2_at" TIMESTAMP(3),
    "followup_3_at" TIMESTAMP(3),
    "proposal_amount" DOUBLE PRECISION,
    "proposal_date" TIMESTAMP(3),
    "proposal_status" TEXT,
    "score" INTEGER DEFAULT 0,
    "score_label" TEXT,
    "scored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_user_id" TEXT,
    "sent_by_user_id" TEXT,
    "sent_by_name" TEXT,
    "contacted_by_user_id" TEXT,
    "contacted_by_name" TEXT,
    "contacted_at" TIMESTAMP(3),
    "last_action_by_user_id" TEXT,
    "last_action_by_name" TEXT,
    "last_action_at" TIMESTAMP(3),
    "campaign_id" TEXT,
    "source" TEXT DEFAULT 'MANUAL',

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_notes" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_activities" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "client_id" TEXT,
    "contact_person" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "timeline" TEXT NOT NULL DEFAULT '',
    "payment_terms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "package_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "owner_user_id" TEXT,
    "owner_name" TEXT,
    "prospect_id" TEXT,
    "proposal_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "contract_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acquisition_source" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "account_manager_id" TEXT,
    "prospect_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_id" TEXT,
    "prospect_id" TEXT,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CALL',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "next_action" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "proposal_id" TEXT,
    "prospect_id" TEXT,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payment_terms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "signed_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "signature_data" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by_name" TEXT,
    "signed_by_email" TEXT,
    "signature_ip" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_dm" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channel_members" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attach_type" TEXT,
    "attach_id" TEXT,
    "attach_label" TEXT,
    "attach_href" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_activities" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "action_type" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "due_date" TIMESTAMP(3),
    "parent_type" TEXT,
    "parent_id" TEXT,
    "parent_label" TEXT,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "proposal_id" TEXT,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT,
    "client_phone" TEXT,
    "client_address" TEXT,
    "items" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "read_time" INTEGER NOT NULL DEFAULT 5,
    "author" TEXT NOT NULL DEFAULT 'Ibda3 Digital',
    "image" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "notes" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "city" TEXT,
    "template_id" TEXT,
    "owner_id" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_targets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "target_imports" INTEGER NOT NULL DEFAULT 0,
    "target_contacts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_sweeps" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "neighborhood" TEXT,
    "keyword" TEXT,
    "query" TEXT,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "unique_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "started_by_id" TEXT,
    "started_by_name" TEXT,

    CONSTRAINT "discovery_sweeps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_results" (
    "id" TEXT NOT NULL,
    "sweep_id" TEXT,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "sector" TEXT NOT NULL DEFAULT '',
    "source_url" TEXT NOT NULL DEFAULT '',
    "ai_summary" TEXT NOT NULL DEFAULT '',
    "suggested_offer" TEXT NOT NULL DEFAULT '',
    "website_summary" TEXT NOT NULL DEFAULT '',
    "opportunity_explanation" TEXT NOT NULL DEFAULT '',
    "opportunity_score" INTEGER NOT NULL DEFAULT 0,
    "confidence_score" INTEGER NOT NULL DEFAULT 0,
    "suggested_segment" "ProspectSegment" NOT NULL DEFAULT 'LEGACY_COLD',
    "website_valid" BOOLEAN NOT NULL DEFAULT false,
    "email_valid" BOOLEAN NOT NULL DEFAULT false,
    "phone_valid" BOOLEAN NOT NULL DEFAULT false,
    "instagram_valid" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_valid" BOOLEAN NOT NULL DEFAULT false,
    "source_valid" BOOLEAN NOT NULL DEFAULT false,
    "website_status" TEXT NOT NULL DEFAULT 'MISSING',
    "email_status" TEXT NOT NULL DEFAULT 'MISSING',
    "phone_status" TEXT NOT NULL DEFAULT 'MISSING',
    "whatsapp_status" TEXT NOT NULL DEFAULT 'MISSING',
    "instagram_status" TEXT NOT NULL DEFAULT 'MISSING',
    "whatsapp_url" TEXT NOT NULL DEFAULT '',
    "instagram_url" TEXT NOT NULL DEFAULT '',
    "email_subject" TEXT NOT NULL DEFAULT '',
    "email_body" TEXT NOT NULL DEFAULT '',
    "whatsapp_body" TEXT NOT NULL DEFAULT '',
    "ai_provider" TEXT NOT NULL DEFAULT 'MOCK',
    "duplicate_status" TEXT NOT NULL DEFAULT 'NEW',
    "duplicate_reason" TEXT,
    "duplicate_prospect_id" TEXT,
    "imported_prospect_id" TEXT,
    "imported_at" TIMESTAMP(3),
    "imported_by_id" TEXT,
    "imported_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_scripts" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_messages" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "template_id" TEXT,
    "template_key" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by_id" TEXT,
    "sent_by_name" TEXT NOT NULL DEFAULT '',
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "replied_at" TIMESTAMP(3),
    "reply_reason" TEXT,
    "variant_label" TEXT,
    "tone" TEXT,
    "objective" TEXT,
    "meeting_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_name" TEXT NOT NULL DEFAULT '',
    "client_id" TEXT,
    "project_name" TEXT NOT NULL DEFAULT '',
    "project_id" TEXT,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'FR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "document_date" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "notes" TEXT NOT NULL DEFAULT '',
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "document_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "planned_at" TIMESTAMP(3),
    "pillar" TEXT NOT NULL DEFAULT '',
    "hook" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "media_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "next_action" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "published_at" TIMESTAMP(3),
    "published_url" TEXT NOT NULL DEFAULT '',
    "views" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "follows" INTEGER,
    "metrics_updated_at" TIMESTAMP(3),
    "source_key" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_translations_project_id_locale_key" ON "project_translations"("project_id", "locale");

-- CreateIndex
CREATE INDEX "prospects_campaign_id_idx" ON "prospects"("campaign_id");

-- CreateIndex
CREATE INDEX "prospects_segment_idx" ON "prospects"("segment");

-- CreateIndex
CREATE INDEX "meetings_client_id_idx" ON "meetings"("client_id");

-- CreateIndex
CREATE INDEX "meetings_prospect_id_idx" ON "meetings"("prospect_id");

-- CreateIndex
CREATE INDEX "meetings_owner_id_status_idx" ON "meetings"("owner_id", "status");

-- CreateIndex
CREATE INDEX "meetings_start_at_status_idx" ON "meetings"("start_at", "status");

-- CreateIndex
CREATE INDEX "contracts_client_id_idx" ON "contracts"("client_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_end_date_idx" ON "contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "chat_channels_slug_key" ON "chat_channels"("slug");

-- CreateIndex
CREATE INDEX "chat_channel_members_user_id_idx" ON "chat_channel_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_channel_members_channel_id_user_id_key" ON "chat_channel_members"("channel_id", "user_id");

-- CreateIndex
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages"("channel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_reactions_message_id_user_id_emoji_key" ON "chat_reactions"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "tasks_owner_id_status_idx" ON "tasks"("owner_id", "status");

-- CreateIndex
CREATE INDEX "tasks_parent_type_parent_id_idx" ON "tasks"("parent_type", "parent_id");

-- CreateIndex
CREATE INDEX "tasks_due_date_status_idx" ON "tasks"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_locale_published_idx" ON "blog_posts"("locale", "published");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_locale_key" ON "blog_posts"("slug", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_templates_key_key" ON "outreach_templates"("key");

-- CreateIndex
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");

-- CreateIndex
CREATE INDEX "daily_targets_date_idx" ON "daily_targets"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_targets_user_id_date_key" ON "daily_targets"("user_id", "date");

-- CreateIndex
CREATE INDEX "discovery_sweeps_city_sector_neighborhood_started_at_idx" ON "discovery_sweeps"("city", "sector", "neighborhood", "started_at");

-- CreateIndex
CREATE INDEX "discovery_sweeps_started_at_idx" ON "discovery_sweeps"("started_at");

-- CreateIndex
CREATE INDEX "discovery_results_sweep_id_idx" ON "discovery_results"("sweep_id");

-- CreateIndex
CREATE INDEX "discovery_results_duplicate_status_idx" ON "discovery_results"("duplicate_status");

-- CreateIndex
CREATE INDEX "discovery_results_created_at_idx" ON "discovery_results"("created_at");

-- CreateIndex
CREATE INDEX "sales_scripts_category_idx" ON "sales_scripts"("category");

-- CreateIndex
CREATE INDEX "outreach_messages_prospect_id_idx" ON "outreach_messages"("prospect_id");

-- CreateIndex
CREATE INDEX "outreach_messages_template_id_idx" ON "outreach_messages"("template_id");

-- CreateIndex
CREATE INDEX "outreach_messages_sent_by_id_idx" ON "outreach_messages"("sent_by_id");

-- CreateIndex
CREATE INDEX "outreach_messages_sent_at_idx" ON "outreach_messages"("sent_at");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_archived_at_idx" ON "documents"("archived_at");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_posts_source_key_key" ON "content_posts"("source_key");

-- CreateIndex
CREATE INDEX "content_posts_status_idx" ON "content_posts"("status");

-- CreateIndex
CREATE INDEX "content_posts_planned_at_idx" ON "content_posts"("planned_at");

-- CreateIndex
CREATE INDEX "content_posts_archived_at_idx" ON "content_posts"("archived_at");

-- AddForeignKey
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_contacted_by_user_id_fkey" FOREIGN KEY ("contacted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_last_action_by_user_id_fkey" FOREIGN KEY ("last_action_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "chat_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "chat_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "outreach_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_targets" ADD CONSTRAINT "daily_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_results" ADD CONSTRAINT "discovery_results_sweep_id_fkey" FOREIGN KEY ("sweep_id") REFERENCES "discovery_sweeps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "outreach_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

