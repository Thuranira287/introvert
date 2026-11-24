'use client';

import Link from 'next/link';
import { ArrowLeft, Heart, Bookmark, Eye } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardBody, Avatar, Button, Badge, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdUnit } from '@/components/ads/AdUnit';
import { AD_SLOTS } from '@/components/ads/ad-slots';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface Blog {
  id: string;
  title: string;
  content: string;
  views: number;
  readingTime: number;
  createdAt: string;
  author: { username: string; displayName: string };
  category?: { name: string } | null;
  _count: { likes: number };
}

interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string; displayName: string };
  replies: CommentNode[];
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

function CommentThread({ comment, onReply, depth = 0 }: { comment: CommentNode; onReply: (parentId: string) => void; depth?: number }) {
  return (
    <div style={{ marginLeft: depth * 24 }} className="mb-4">
      <Card>
        <CardBody>
          <div className="flex gap-3">
            <Avatar size="md" initials={initialsOf(comment.author.displayName)} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/profile/${comment.author.username}`} className="font-medium text-gray-900 hover:text-indigo-600">
                  {comment.author.displayName}
                </Link>
                <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 text-sm">{comment.content}</p>
              {depth < 3 && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-xs text-indigo-600 font-medium mt-2 hover:text-indigo-700"
                >
                  Reply
                </button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      {comment.replies?.map((reply) => (
        <CommentThread key={reply.id} comment={reply} onReply={onReply} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function BlogDetailPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const params = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(async (blogId: string) => {
    const response = await api.get(`/blogs/${blogId}/comments`);
    setComments(response.data.data);
  }, []);

  useEffect(() => {
    if (!user || !params.slug) return;

    (async () => {
      try {
        const response = await api.get(`/blogs/${params.slug}`);
        const blogData = response.data.data;
        setBlog(blogData);
        await fetchComments(blogData.id);
      } catch (err) {
        logger.error('Failed to load blog', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user, params.slug, fetchComments]);

  const handleLike = async () => {
    if (!blog) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    try {
      await api.post(`/blogs/${blog.id}/like`);
    } catch {
      setIsLiked(wasLiked);
    }
  };

  const handleBookmark = async () => {
    if (!blog) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    try {
      await api.post(`/blogs/${blog.id}/bookmark`);
    } catch {
      setIsBookmarked(wasBookmarked);
    }
  };

  const [isReported, setIsReported] = useState(false);
  const handleReport = async () => {
    if (!blog || isReported) return;
    const reason = window.prompt('Tell us what\'s wrong with this post (this goes to our moderation team):');
    if (!reason?.trim()) return;

    try {
      await api.post('/reports', { entityType: 'blog', entityId: blog.id, reason });
      setIsReported(true);
    } catch (err) {
      logger.error('Failed to submit report', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !blog) return;

    try {
      await api.post(`/blogs/${blog.id}/comments`, { content: commentText, parentId: replyTo ?? undefined });
      setCommentText('');
      setReplyTo(null);
      await fetchComments(blog.id);
    } catch (err) {
      logger.error('Failed to post comment', err);
    }
  };

  if (authLoading || !user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!blog) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-600">Blog not found.</main>
      </>
    );
  }

  const paragraphs = blog.content.split('\n\n');
  const midpoint = Math.ceil(paragraphs.length / 2);

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/blogs" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm mb-6 inline-block">
            <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
            Back to Blogs
          </Link>

          <Card>
            <CardBody className="p-8">
              {blog.category && <Badge variant="info">{blog.category.name}</Badge>}

              <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-6">{blog.title}</h1>

              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
                <Link href={`/profile/${blog.author.username}`} className="flex items-center gap-3">
                  <Avatar size="lg" initials={initialsOf(blog.author.displayName)} />
                  <div>
                    <p className="font-bold text-gray-900">{blog.author.displayName}</p>
                  </div>
                </Link>
                <div className="text-right text-sm text-gray-500">
                  <p>{blog.readingTime} min read</p>
                  <p>{new Date(blog.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-line mb-8">
                <div>{paragraphs.slice(0, midpoint).join('\n\n')}</div>
                {paragraphs.length > 1 && (
                  <div className="not-prose my-6">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Advertisement</p>
                    <AdUnit slot={AD_SLOTS.blogInArticle} format="in-article" style={{ minHeight: 250 }} />
                  </div>
                )}
                <div>{paragraphs.slice(midpoint).join('\n\n')}</div>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isLiked ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                  {blog._count.likes + (isLiked ? 1 : 0)}
                </button>
                <button
                  onClick={handleBookmark}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isBookmarked ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                  {isBookmarked ? 'Saved' : 'Save'}
                </button>
                <span className="text-gray-500 text-sm ml-auto flex items-center gap-1">
                  <Eye size={14} /> {blog.views} views
                </span>
                <button
                  onClick={handleReport}
                  disabled={isReported}
                  className="text-xs text-gray-400 hover:text-red-500 disabled:hover:text-gray-400"
                >
                  {isReported ? 'Reported' : 'Report'}
                </button>
              </div>
            </CardBody>
          </Card>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Comments ({comments.length})</h2>

            <Card className="mb-6">
              <CardBody>
                {replyTo && (
                  <div className="flex items-center justify-between mb-3 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span>Replying to a comment</span>
                    <button onClick={() => setReplyTo(null)} className="text-indigo-600 font-medium">
                      Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={handleAddComment} className="flex gap-3">
                  <Avatar size="md" initials={initialsOf(user.displayName)} />
                  <div className="flex-1 flex gap-3">
                    <Input
                      placeholder="Add a thoughtful comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      fullWidth
                    />
                    <Button type="submit" disabled={!commentText.trim()}>
                      Post
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            {comments.map((comment) => (
              <CommentThread key={comment.id} comment={comment} onReply={setReplyTo} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
