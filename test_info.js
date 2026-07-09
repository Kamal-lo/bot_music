import play from 'play-dl';

async function test() {
  try {
    const url = 'https://www.youtube.com/watch?v=kTJczUoc26U';
    const info = await play.video_info(url);
    console.log('Video Info retrieved successfully!');
    console.log('Video Details keys:', Object.keys(info.video_details));
    console.log('Format length:', info.format.length);
    console.log('Streaming URL (first format):', info.format[0]?.url);
  } catch (err) {
    console.error('Error in video_info:', err);
  }
}

test();
