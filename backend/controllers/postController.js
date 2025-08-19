const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');

exports.createPost = async (req, res) => {
  try {
    const { location, type, waitTime } = req.body;
    const imageUrl = req.file.path.replace('backend', '');
    const post = new Post({
      user: req.userId,
      location,
      type,
      waitTime,
      imageUrl
    });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate('user likes comments');
    res.json(posts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post.likes.includes(req.userId)) {
      post.likes.push(req.userId);
      await post.save();
    }
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.commentPost = async (req, res) => {
  try {
    const comment = new Comment({
      user: req.userId,
      post: req.params.id,
      text: req.body.text
    });
    await comment.save();
    const post = await Post.findById(req.params.id);
    post.comments.push(comment._id);
    await post.save();
    res.status(201).json(comment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('user likes comments');
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
