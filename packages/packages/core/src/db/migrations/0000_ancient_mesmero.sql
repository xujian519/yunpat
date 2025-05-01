CREATE TYPE "public"."deadline_type" AS ENUM('oa_response', 'renewal_fee', 'publication_fee', 'examination_fee', 'appeal_deadline', 'priority_claim', 'other');--> statement-breakpoint
CREATE TYPE "public"."fee_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('email', 'webhook', 'sms', 'system');--> statement-breakpoint
CREATE TYPE "public"."patent_status" AS ENUM('draft', 'filed', 'under_exam', 'oa_issued', 'amended', 'allowed', 'granted', 'rejected', 'abandoned', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."patent_type" AS ENUM('invention', 'utility', 'design');--> statement-breakpoint
CREATE TABLE "graph_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"data" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "graph_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer,
	"to_id" integer,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"embedding" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"config" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer,
	"type" "notification_type" NOT NULL,
	"event" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patent_deadlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"type" "deadline_type" NOT NULL,
	"deadline_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"reminder_date" timestamp,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patent_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"fee_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "fee_status" DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp,
	"payment_reference" text,
	"notes" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patent_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"event_type" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"description" text NOT NULL,
	"user_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patents" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"title" text NOT NULL,
	"applicant" text NOT NULL,
	"inventors" text NOT NULL,
	"patent_type" "patent_type" NOT NULL,
	"filing_date" timestamp NOT NULL,
	"status" "patent_status" DEFAULT 'draft' NOT NULL,
	"priority_claims" text,
	"attorney" text,
	"classification" text,
	"abstract" text,
	"description" text,
	"claims" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patents_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
ALTER TABLE "graph_relations" ADD CONSTRAINT "graph_relations_from_id_graph_entities_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."graph_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_relations" ADD CONSTRAINT "graph_relations_to_id_graph_entities_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."graph_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."notification_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_deadlines" ADD CONSTRAINT "patent_deadlines_application_number_patents_application_number_fk" FOREIGN KEY ("application_number") REFERENCES "public"."patents"("application_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_fees" ADD CONSTRAINT "patent_fees_application_number_patents_application_number_fk" FOREIGN KEY ("application_number") REFERENCES "public"."patents"("application_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_history" ADD CONSTRAINT "patent_history_application_number_patents_application_number_fk" FOREIGN KEY ("application_number") REFERENCES "public"."patents"("application_number") ON DELETE no action ON UPDATE no action;