export interface Page {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface PageListItem {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}
