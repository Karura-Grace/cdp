// Evidence files: what may be uploaded (also enforced by the database, migration 17).
export const MAX_BYTES = 20 * 1024 * 1024;
export const TYPES: Record<string, string> = {
  "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word", "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel", "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint", "application/vnd.ms-powerpoint": "PowerPoint",
};
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
/** A storage-safe name: letters, digits, dot, dash and underscore only. */
export const safeName = (n: string) => n.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(-120) || "file";
