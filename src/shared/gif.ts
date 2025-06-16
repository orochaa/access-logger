import { randomNumberBetween } from './utils.js'

export async function getRandomGifUrl(): Promise<string> {
  const url = new URL('https://api.giphy.com/v1/gifs/search')
  url.searchParams.set('api_key', process.env.GIPHY_ACCESS_TOKEN ?? '')
  url.searchParams.set('q', 'celebration')
  url.searchParams.set('offset', String(randomNumberBetween(0, 25)))
  url.searchParams.set('limit', String(25))
  url.searchParams.set('rating', 'g')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('bundle', 'messaging_non_clips')

  const res = await fetch(url.toString())

  if (!res.ok) {
    console.error(
      `Giphy API error: ${res.status} ${res.statusText}`,
      await res.text()
    )

    return ''
  }

  const { data } = (await res.json()) as {
    data: { images: { original: { url: string } } }[]
  }
  const gifList = data.map(item => item.images.original.url)
  const randomGif = gifList[randomNumberBetween(0, gifList.length - 1)]

  return randomGif
}
