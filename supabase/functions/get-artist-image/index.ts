import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const getOptimalImage = (images: any[], targetWidth: number = 300) => {
  if (!images || images.length === 0) return null;
  
  const optimalImage = images.reduce((prev, curr) => {
    return (Math.abs(curr.width - targetWidth) < Math.abs(prev.width - targetWidth) ? curr : prev);
  });
  
  return optimalImage.url;
};

serve(async (req) => {
  const { artistName } = await req.json();

  if (!artistName) {
    return new Response(JSON.stringify({ error: 'Artist name required' }), { status: 400 });
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;
    
    const query = encodeURIComponent(artistName);
    
    const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=artist&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const searchData = await searchResponse.json();
    const images = searchData.artists?.items[0]?.images;
    const imageUrl = getOptimalImage(images, 300);

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});