CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"otp_code" text,
	"otp_expires_at" timestamp with time zone,
	"device_fingerprint" text,
	"theme" text DEFAULT 'dark' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'expired' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"days_paid" integer DEFAULT 0 NOT NULL,
	"expiry_warning_sent_at" timestamp with time zone,
	"expiry_warning_1d_sent_at" timestamp with time zone,
	"expiry_warning_0d_sent_at" timestamp with time zone,
	"free_trial_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"phone" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mpesa_receipt" text,
	"checkout_request_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"metaapi_account_id" text,
	"platform" text DEFAULT 'mt5' NOT NULL,
	"mt5_login" text NOT NULL,
	"broker" text NOT NULL,
	"server" text NOT NULL,
	"investor_password_encrypted" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"deployment_status" text,
	"connection_status" text,
	"rejection_reason" text,
	"synchronization_status" text,
	"last_error_message" text,
	"metaapi_region" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"copyfactory_provider_id" text,
	"copyfactory_provider_status" text,
	"copyfactory_provider_registered_at" timestamp with time zone,
	"copyfactory_last_api_response" text,
	"copyfactory_last_error" text
);
--> statement-breakpoint
CREATE TABLE "slave_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"metaapi_account_id" text,
	"subscriber_id" text,
	"platform" text DEFAULT 'mt5' NOT NULL,
	"mt5_login" text NOT NULL,
	"broker" text NOT NULL,
	"server" text NOT NULL,
	"trading_password_encrypted" text NOT NULL,
	"status" text DEFAULT 'connecting' NOT NULL,
	"deployment_status" text,
	"connection_status" text,
	"synchronization_status" text,
	"last_error_message" text,
	"metaapi_region" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"copyfactory_subscriber_id" text,
	"copyfactory_subscriber_status" text,
	"copyfactory_subscriber_registered_at" timestamp with time zone,
	"copyfactory_last_api_response" text,
	"copyfactory_last_error" text,
	"copyfactory_last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"copyfactory_strategy_id" text,
	"strategy_name" text NOT NULL,
	"master_account_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"slave_account_id" integer NOT NULL,
	"risk_multiplier" numeric(5, 2) DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "bindings_slave_strategy_unique" UNIQUE("slave_account_id","strategy_id")
);
--> statement-breakpoint
CREATE TABLE "trade_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"slave_account_id" integer,
	"action" text NOT NULL,
	"symbol" text,
	"side" text,
	"volume" numeric,
	"profit" numeric,
	"open_price" numeric,
	"close_price" numeric,
	"transaction_id" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_fee" numeric(10, 2) DEFAULT '100' NOT NULL,
	"min_days" integer DEFAULT 1 NOT NULL,
	"max_days" integer DEFAULT 365 NOT NULL,
	"meta_api_token" text,
	"expiry_warning_days" integer DEFAULT 3 NOT NULL,
	"default_theme" text DEFAULT 'dark' NOT NULL,
	"active_strategy_id" integer,
	"free_trial_days" integer DEFAULT 2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"media_type" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"cloudinary_public_id" text,
	"category" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"headline" text NOT NULL,
	"featured_image_url" text,
	"summary" text,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"author" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"resource_type" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"image_url" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_mode" text DEFAULT 'ticker' NOT NULL,
	"background_color" text DEFAULT '#0a0f1e' NOT NULL,
	"primary_color" text DEFAULT '#2563eb' NOT NULL,
	"secondary_color" text DEFAULT '#16a34a' NOT NULL,
	"text_color" text DEFAULT '#f1f5f9' NOT NULL,
	"bullish_color" text DEFAULT '#16a34a' NOT NULL,
	"bearish_color" text DEFAULT '#dc2626' NOT NULL,
	"font_family" text DEFAULT 'Inter' NOT NULL,
	"font_size" integer DEFAULT 13 NOT NULL,
	"banner_height" integer DEFAULT 48 NOT NULL,
	"ticker_speed" integer DEFAULT 40 NOT NULL,
	"refresh_rate" integer DEFAULT 10 NOT NULL,
	"selected_pairs" text DEFAULT '["EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","NZD/USD","USD/CAD","EUR/GBP","EUR/JPY","GBP/JPY"]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_name" text DEFAULT 'MSpace' NOT NULL,
	"api_url" text DEFAULT 'https://api.mspace.co.ke/sms/v1/send' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"sender_id" text DEFAULT 'PESAMTRX' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"template" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_templates_event_type_unique" UNIQUE("event_type")
);
--> statement-breakpoint
CREATE TABLE "sms_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_id" integer,
	"user_id" integer,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"provider_response" text,
	"delivery_status" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trade_alerts" boolean DEFAULT true NOT NULL,
	"subscription_alerts" boolean DEFAULT true NOT NULL,
	"announcements" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_account_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_account_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"admin_id" integer,
	"event" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" text NOT NULL,
	"total_referrals" integer DEFAULT 0 NOT NULL,
	"total_reward_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_user_id" integer NOT NULL,
	"referred_phone" text NOT NULL,
	"referred_email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reward_days" integer,
	"rewarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referred_user_id_unique" UNIQUE("referred_user_id")
);
--> statement-breakpoint
CREATE TABLE "referral_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrals_required" integer NOT NULL,
	"reward_days" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_search_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_term" text NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_care_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone1" text DEFAULT '' NOT NULL,
	"phone2" text,
	"whatsapp" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"support_hours" text DEFAULT 'Mon-Fri 8AM-6PM' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_fee" numeric(10, 2) DEFAULT '5000' NOT NULL,
	"max_funding_accounts" integer DEFAULT 10 NOT NULL,
	"funding_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"trading_experience" text NOT NULL,
	"broker_name" text,
	"mt5_account_number" text,
	"account_type" text DEFAULT 'Live' NOT NULL,
	"trading_strategy" text NOT NULL,
	"additional_notes" text,
	"application_fee" numeric(10, 2) NOT NULL,
	"checkout_request_id" text,
	"mpesa_receipt" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"mt5_server" text,
	"investor_password_encrypted" text,
	"mt5_verification_status" text DEFAULT 'pending' NOT NULL,
	"mt5_verification_date" timestamp with time zone,
	"mt5_verification_result" text,
	"mt5_verification_attempts" integer DEFAULT 0 NOT NULL,
	"metaapi_verification_account_id" text,
	"metaapi_verification_region" text,
	"admin_notes" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"funding_granted_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"linked_slave_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_verification_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"broker_name" text NOT NULL,
	"mt5_account_number" text NOT NULL,
	"mt5_server" text NOT NULL,
	"result_status" text NOT NULL,
	"result" text NOT NULL,
	"metaapi_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_masters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"metaapi_account_id" text,
	"strategy_id" text,
	"strategy_group_id" integer,
	"broker" text,
	"server" text,
	"status" text DEFAULT 'OFFLINE' NOT NULL,
	"capacity" integer DEFAULT 2000 NOT NULL,
	"current_load" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"uptime_seconds" integer DEFAULT 0 NOT NULL,
	"last_online_at" timestamp with time zone,
	"last_offline_at" timestamp with time zone,
	"latency_ms" integer,
	"failed_replications" integer DEFAULT 0 NOT NULL,
	"connection_status" text,
	"synchronization_status" text,
	"region" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "master_bindings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"distribution_master_id" integer NOT NULL,
	"subscription_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"target_master_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_bindings_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trading_master_id" integer,
	"distribution_master_id" integer,
	"subscriber_id" integer,
	"broker" text,
	"account_type" text,
	"trade_action" text,
	"symbol" text,
	"entry_price" numeric(20, 8),
	"stop_loss" numeric(20, 8),
	"take_profit" numeric(20, 8),
	"execution_time" timestamp with time zone,
	"replication_latency_ms" integer,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"failure_reason" text,
	"ticket" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_end_date_idx" ON "subscriptions" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "subscriptions_status_end_date_idx" ON "subscriptions" USING btree ("status","end_date");--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_checkout_request_id_idx" ON "payments" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_mpesa_receipt_idx" ON "payments" USING btree ("mpesa_receipt");--> statement-breakpoint
CREATE INDEX "master_accounts_user_id_idx" ON "master_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "master_accounts_status_idx" ON "master_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "master_accounts_metaapi_account_id_idx" ON "master_accounts" USING btree ("metaapi_account_id");--> statement-breakpoint
CREATE INDEX "slave_accounts_user_id_idx" ON "slave_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "slave_accounts_status_idx" ON "slave_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "slave_accounts_metaapi_account_id_idx" ON "slave_accounts" USING btree ("metaapi_account_id");--> statement-breakpoint
CREATE INDEX "slave_accounts_subscriber_id_idx" ON "slave_accounts" USING btree ("subscriber_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slave_accounts_mt5_login_uidx" ON "slave_accounts" USING btree ("mt5_login");--> statement-breakpoint
CREATE INDEX "strategies_user_id_idx" ON "strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategies_master_account_id_idx" ON "strategies" USING btree ("master_account_id");--> statement-breakpoint
CREATE INDEX "strategies_copyfactory_strategy_id_idx" ON "strategies" USING btree ("copyfactory_strategy_id");--> statement-breakpoint
CREATE INDEX "bindings_strategy_id_idx" ON "strategy_subscribers" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "bindings_slave_account_id_idx" ON "strategy_subscribers" USING btree ("slave_account_id");--> statement-breakpoint
CREATE INDEX "bindings_status_idx" ON "strategy_subscribers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trade_logs_strategy_id_idx" ON "trade_logs" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "trade_logs_slave_account_id_idx" ON "trade_logs" USING btree ("slave_account_id");--> statement-breakpoint
CREATE INDEX "trade_logs_created_at_idx" ON "trade_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_logs_transaction_id_uidx" ON "trade_logs" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prt_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "prt_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sms_queue_status_idx" ON "sms_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_queue_scheduled_idx" ON "sms_queue" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "sms_queue_user_id_idx" ON "sms_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sms_logs_status_idx" ON "sms_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_logs_user_id_idx" ON "sms_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sms_logs_event_type_idx" ON "sms_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "sms_logs_created_at_idx" ON "sms_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_prefs_user_id_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "master_audit_master_id_idx" ON "master_account_audit_logs" USING btree ("master_account_id");--> statement-breakpoint
CREATE INDEX "master_audit_created_at_idx" ON "master_account_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_user_id_uidx" ON "promo_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_uidx" ON "promo_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referrals_referrer_id_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_user_id_uidx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "faqs_status_idx" ON "faqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "faqs_sort_order_idx" ON "faqs" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "funding_applications_user_id_idx" ON "funding_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "funding_applications_status_idx" ON "funding_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funding_applications_email_idx" ON "funding_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_applications_mt5_account_number_uidx" ON "funding_applications" USING btree ("mt5_account_number");--> statement-breakpoint
CREATE INDEX "funding_verification_attempts_application_id_idx" ON "funding_verification_attempts" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "funding_verification_attempts_user_id_idx" ON "funding_verification_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dist_masters_status_idx" ON "distribution_masters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dist_masters_strategy_group_idx" ON "distribution_masters" USING btree ("strategy_group_id");--> statement-breakpoint
CREATE INDEX "dist_masters_priority_idx" ON "distribution_masters" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "strategy_groups_status_idx" ON "strategy_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "master_bindings_user_id_idx" ON "master_bindings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "master_bindings_master_id_idx" ON "master_bindings" USING btree ("distribution_master_id");--> statement-breakpoint
CREATE INDEX "master_bindings_status_idx" ON "master_bindings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "master_bindings_subscription_id_idx" ON "master_bindings" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "trade_audit_created_idx" ON "trade_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trade_audit_subscriber_idx" ON "trade_audit_logs" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "trade_audit_dist_master_idx" ON "trade_audit_logs" USING btree ("distribution_master_id");--> statement-breakpoint
CREATE INDEX "trade_audit_trading_master_idx" ON "trade_audit_logs" USING btree ("trading_master_id");--> statement-breakpoint
CREATE INDEX "trade_audit_symbol_idx" ON "trade_audit_logs" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trade_audit_status_idx" ON "trade_audit_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trade_audit_broker_idx" ON "trade_audit_logs" USING btree ("broker");