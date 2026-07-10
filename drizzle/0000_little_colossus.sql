CREATE TABLE `collections` (
	`user_email` text NOT NULL,
	`card_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`card_name` text NOT NULL,
	`grade` text NOT NULL,
	`sprite_key` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`first_drawn_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `card_id`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "collections_count_positive" CHECK("collections"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`card_name` text NOT NULL,
	`grade` text NOT NULL,
	`unit` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`condition_note` text NOT NULL,
	`sprite_key` text NOT NULL,
	PRIMARY KEY(`order_id`, `product_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_items_quantity_positive" CHECK("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`subtotal` integer NOT NULL,
	`delivery_fee` integer NOT NULL,
	`total` integer NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`destination` text NOT NULL,
	`delivery_slot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`verification_code` text NOT NULL,
	`points_earned` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('placed', 'out_for_delivery', 'delivered')),
	CONSTRAINT "orders_totals_nonnegative" CHECK("orders"."subtotal" >= 0 and "orders"."delivery_fee" >= 0 and "orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`card_name` text NOT NULL,
	`category` text NOT NULL,
	`grade` text NOT NULL,
	`price` integer NOT NULL,
	`unit` text NOT NULL,
	`origin` text NOT NULL,
	`stock` integer NOT NULL,
	`max_per_order` integer NOT NULL,
	`condition_note` text NOT NULL,
	`sprite_key` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "products_category_check" CHECK("products"."category" in ('vegetable', 'fruit')),
	CONSTRAINT "products_grade_check" CHECK("products"."grade" in ('S', 'A', 'B', 'C')),
	CONSTRAINT "products_price_nonnegative" CHECK("products"."price" >= 0),
	CONSTRAINT "products_stock_nonnegative" CHECK("products"."stock" >= 0),
	CONSTRAINT "products_max_per_order_positive" CHECK("products"."max_per_order" > 0)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`free_draw_week` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('owner', 'customer')),
	CONSTRAINT "users_points_nonnegative" CHECK("users"."points" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_single_owner_idx` ON `users` (`role`) WHERE "users"."role" = 'owner';--> statement-breakpoint
CREATE TABLE `weekly_draws` (
	`user_email` text NOT NULL,
	`week_key` text NOT NULL,
	`drawn_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `week_key`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
