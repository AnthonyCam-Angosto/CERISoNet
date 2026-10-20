export interface Post {
  id: number | string;
  content: string;
  image?: { url: string; title: string };
  author: string;
  date: string;
  likes: number;
  hashtags?: string[];
  shared?: number | string;
  comments?: Comment[];
  likedByCurrentUser?: boolean;
  sharedPost?: Post;
}

export interface Comment {
  id: number;
  text: string;
  author: string;
  date: string;
}

export interface NewPostDialogData {
  sharedPostId?: number | string;
}
