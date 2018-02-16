var instagram = require('public-instagram');
 
// Async function in order to use await
async function example() {
 
    // Get information about hashtag
    const info = await instagram.tags.info('quierobesarte.es');
    console.log(info);
 
    // Get the 1000 most recent posts that contain an hashtag
    const posts = await instagram.tags.recent('quierobesarte.es', 1000);
    console.log(posts.length);
 
    // Get the most popular posts that contain an hashtag
     posts = await instagram.tags.top('quierobesarte.es');
    console.log(posts);
 
    // Search hashtags by a string field
    const hashtags = await instagram.tags.search('quierobesarte.es');
    console.log(hashtags);
 
    // Get media by shortcode
     post = await instagram.media.get('BP-rXUGBPJa');
    console.log(post);
 
    // Get the 1000 most recent comments of that post
    const comments = await instagram.media.comments('BP-rXUGBPJa', 1000);
    console.log(comments);
 
    // Get information about a public user
    const user = await instagram.users.info('quierobesarte.es');
    console.log(user);
 
    // Get all posts from a public user
     posts = await instagram.users.posts('quierobesarte.es');
    console.log(posts.length);
 
};
 
example();