CREATE TABLE "paper_abstract_embeddings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"abstract_embedding" vector(3072) NOT NULL,
	"abstract_embedding_half" halfvec(3072) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paper_abstract_embeddings" ADD CONSTRAINT "paper_abstract_embeddings_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_paper_version_embeddings_embedding" ON "paper_abstract_embeddings" USING hnsw ("abstract_embedding_half" halfvec_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_paper_abstract_embeddings_paper_id" ON "paper_abstract_embeddings" USING btree ("paper_id");