import 'dotenv/config';
import { Interface } from 'readline';

const SERPER_SEARCH_API_KEY = process.env.SERPER_SEARCH_API_KEY!;

export interface webPageSearchResult {
    text: string,
    title: string
    description: string,
}

export interface overviewWebSearchResult {
    overview: Array<{
        title: string,
        link: string,
        snippet: string
        position: number
    }>
}


if (!SERPER_SEARCH_API_KEY) {
    throw new Error("SERPER_SEARCH_API_KEY not set in environment");
}

export async function overviewWebSearch(query: string, lang: string, country: string): Promise<overviewWebSearchResult> {
    const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        'headers': {
            'X-API-KEY': SERPER_SEARCH_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "q": query,
            "gl": country,
            "hl": lang
        }),

        redirect: 'follow',
    });
    if (!res.ok) {
        throw new Error(`Error when fetching web data: Code ${res.status} - ${res.statusText}`);
    }
    const data = await res.json();

    const result: overviewWebSearchResult = { overview: data.organic };
    return result;
}

export async function webPageSearch(url: string): Promise<webPageSearchResult> {
    const res = await fetch("https://scrape.serper.dev", {
        method: "POST",
        'headers': {
            'X-API-KEY': SERPER_SEARCH_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "url": url
        }),
        redirect: 'follow',
    });
    if (!res.ok) {
        throw new Error(`Error when fetching web data: Code ${res.status} - ${res.statusText}`);
    }
    const data = await res.json();
    let result: webPageSearchResult = { text: "", title: "", description: "" };
    result.text = data.text;
    result.title = data.metadata.title;
    result.description = data.metadata.description;
    return result;
}

await console.log(await webPageSearch("https://sap.com"));