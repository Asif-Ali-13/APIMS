/** Blog post returned by the demo API. */
export interface Post {
    id: number;
    title: string;
    content: string;
    author: string;
    tags: string[];
    publishedAt: string;
    views: number;
    likes: number;
}


/** Comment attached to a post. */
export interface Comment {
    id: number;
    postId: number;
    author: string;
    content: string;
    timestamp: string;
}


/** Standard success envelope for list/detail responses. */
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}


/** Standard error envelope. */
export interface ApiErrorResponse {
    success: false;
    message: string;
    error?: string;
}
