const DIGIT_PREFIX_PATTERN = /([0-9]|[\u0660-\u0669]|[\u06F0-\u06F9]|[\u0966-\u096F]|[\u09E6-\u09EF]|[\u1040-\u1049]|[\u0E50-\u0E59]|[\u0F20-\u0F29])/;

const SPONSORED_PARAM = "__cft__[0]=";
const SPONSORED_MIN_PARAM_LENGTH = 311;

const getDefaultDocument = (): Document | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document;
};

const trimToken = (value: string): string => value.trim().toLowerCase();

export const CMF_SPONSORED_DICTIONARY = [
  "sponsored",
  "مُموَّل",
  "спонсорирано",
  "sponzorováno",
  "gesponsert",
  "anzeige",
  "χορηγούμενη",
  "publicidad",
  "sponsoroitu",
  "sponsorisé",
  "ממומן",
  "bersponsor",
  "sponsorizzato",
  "広告",
  "apmaksāta reklāma",
  "gesponsord",
  "sponsorowane",
  "patrocinado",
  "реклама",
  "sponsorlu",
  "спонсорована",
  "được tài trợ",
  "赞助内容",
  "贊助"
].map(trimToken);

export const CMF_SUGGESTIONS_DICTIONARY = [
  "suggestions / recommendations",
  "الاقتراحات / التوصيات",
  "предложения / препоръки",
  "návrhy / doporučení",
  "vorschläge / empfehlungen",
  "προτάσεις / συστάσεις",
  "sugerencias / recomendaciones",
  "ehdotuksia / suosituksia",
  "suggestions / recommandations",
  "הצעות / המלצות",
  "saran / rekomendasi",
  "suggerimenti / raccomandazioni",
  "提案/推奨事項",
  "ieteikumi",
  "suggesties / aanbevelingen",
  "sugestie / zalecenia",
  "sugestões / recomendações",
  "предложения / рекомендации",
  "öneriler",
  "пропозиції / рекомендації",
  "đề xuất / khuyến nghị",
  "建议",
  "建議/推薦"
].map(trimToken);

export const CMF_REELS_AND_SHORT_VIDEOS_DICTIONARY = [
  "reels and short videos",
  "ريلز ومقاطع الفيديو القصيرة",
  "ленти и кратки видеоклипове",
  "sekvence a krátká videa",
  "reels und kurzvideos",
  "reel και σύντομα βίντεο",
  "reels y vídeos cortos",
  "keloja ja lyhyitä videoita",
  "reels et vidéos courtes",
  "סרטוני reels וקטעי וידאו קצרים",
  "reels dan video pendek",
  "reel e video brevi",
  "リールとショート動画",
  "reels un īsi videoklipi",
  "reels en korte video's",
  "rolki i krótkie filmy",
  "vídeos do reels e vídeos de curta duração",
  "reels и короткие видео",
  "makaralar ve kısa videolar",
  "відео reels і короткі відео",
  "reels và video ngắn",
  "卷轴和短视频",
  "reels 和短影片"
].map(trimToken);

export const CMF_FOLLOW_DICTIONARY = [
  "follow",
  "تابع",
  "следвай",
  "sledovat",
  "folgen",
  "ακολούθησε",
  "seguir",
  "seuraa",
  "suivre",
  "עקוב",
  "ikuti",
  "segui",
  "フォロー",
  "sekot",
  "volgen",
  "obserwuj",
  "подписаться",
  "takip et",
  "слідуйте",
  "theo dõi",
  "关注",
  "追蹤"
].map(trimToken);

export const CMF_NEWS_FEED_POST_QUERIES = [
  'h3[dir="auto"] ~ div:not([class]) > div > div > div > div > div',
  'h2[dir="auto"] ~ div:not([class]) > div > div > div > div > div',
  'div[role="feed"] > h3[dir="auto"] ~ div:not([class]) > div[data-pagelet*="FeedUnit_"] > div > div > div > div',
  'div[role="feed"] > h2[dir="auto"] ~ div:not([class]) > div[data-pagelet*="FeedUnit_"] > div > div > div > div'
] as const;

const hasDictionaryToken = (value: string, dictionary: string[]): boolean => {
  const lowered = cleanText(value).trim().toLowerCase();
  if (!lowered) {
    return false;
  }
  return dictionary.some((token) => lowered.includes(token));
};

const escapeIdForSelector = (id: string): string => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }
  return id.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/\\@])/g, "\\$1");
};

const textNodeWalkerAvailable = (): boolean => {
  return typeof NodeFilter !== "undefined" && Boolean(getDefaultDocument()?.createTreeWalker);
};

export const cleanText = (value: string): string => value.normalize("NFKC");

export const querySelectorAllNoChildren = (
  container: ParentNode,
  queries: string[] | string,
  minText = 0,
  executeAllQueries = false
): HTMLElement[] => {
  const list = Array.isArray(queries) ? queries : [queries];
  if (!list.length) {
    return [];
  }

  if (executeAllQueries) {
    return Array.from(container.querySelectorAll<HTMLElement>(list.join(","))).filter(
      (element) => element.children.length === 0 && (element.textContent?.length ?? 0) >= minText
    );
  }

  for (let queryIndex = 0; queryIndex < list.length; queryIndex += 1) {
    const query = list[queryIndex];
    const elements = container.querySelectorAll<HTMLElement>(query);
    for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
      const element = elements[elementIndex];
      if (element.children.length === 0 && (element.textContent?.length ?? 0) >= minText) {
        return [element];
      }
    }
  }

  return [];
};

export const countDescendants = (element: ParentNode): number => element.querySelectorAll("div, span").length;

export const scanTreeForText = (node: HTMLElement): string[] => {
  if (!textNodeWalkerAvailable()) {
    return [];
  }

  const values: string[] = [];
  const branches = node.querySelectorAll<HTMLElement>(":scope > div, :scope > blockquote, :scope > span");

  for (let branchIndex = 0; branchIndex < branches.length; branchIndex += 1) {
    const branch = branches[branchIndex];
    if (branch.getAttribute("aria-hidden") === "false") {
      continue;
    }

    const walk = node.ownerDocument.createTreeWalker(branch, NodeFilter.SHOW_TEXT);
    let current = walk.nextNode();
    while (current) {
      const parent = current.parentElement;
      const raw = cleanText(current.textContent ?? "").trim();
      if (!parent || !raw || raw.toLowerCase() === "facebook") {
        current = walk.nextNode();
        continue;
      }

      if (parent.getAttribute("aria-hidden") === "true") {
        current = walk.nextNode();
        continue;
      }

      const parentTag = parent.tagName.toLowerCase();
      if (parentTag === "title") {
        current = walk.nextNode();
        continue;
      }

      if (parentTag === "div" && parent.getAttribute("role") === "button") {
        if (parent.parentElement && parent.parentElement.tagName.toLowerCase() !== "object") {
          current = walk.nextNode();
          continue;
        }
      }

      const buttonContainer = parent.closest("div[role=\"button\"]");
      const descendantsCount = buttonContainer ? countDescendants(buttonContainer) : 0;
      if (descendantsCount < 2 && raw.length > 1) {
        values.push(...raw.split("\n"));
      }

      current = walk.nextNode();
    }
  }

  return [...new Set(values)];
};

export const scanImagesForAltText = (node: HTMLElement): string[] => {
  const values: string[] = [];
  const images = node.querySelectorAll<HTMLImageElement>("img[alt]");

  for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
    const image = images[imageIndex];
    if (!image.alt || image.naturalWidth <= 32) {
      continue;
    }
    const alt = cleanText(image.alt);
    if (!values.includes(alt)) {
      values.push(alt);
    }
  }

  return values;
};

export const getNewsFeedBlocksQuery = (post: HTMLElement): string => {
  let blocksQuery =
    "div[aria-posinset] > div > div > div > div > div > div > div > div, div[aria-describedby] > div > div > div > div > div > div > div > div";
  const blocks = post.querySelectorAll(blocksQuery);
  if (blocks.length <= 1) {
    blocksQuery =
      "div[aria-posinset] > div > div > div > div > div > div > div > div > div, div[aria-describedby] > div > div > div > div > div > div > div > div > div";
  }
  return blocksQuery;
};

export const extractTextContent = (post: HTMLElement, selector: string, maxBlocks: number): string[] => {
  const blocks = post.querySelectorAll<HTMLElement>(selector);
  const values: string[] = [];

  for (let index = 0; index < Math.min(maxBlocks, blocks.length); index += 1) {
    const block = blocks[index];
    if (countDescendants(block) === 0) {
      continue;
    }
    values.push(...scanTreeForText(block));
    values.push(...scanImagesForAltText(block));
  }

  return values.filter((item) => item !== "");
};

const isSponsoredPlain = (post: HTMLElement): boolean => {
  const spans = post.querySelectorAll<HTMLElement>('div[id] > span > a[role="link"] > span');
  for (let spanIndex = 0; spanIndex < spans.length; spanIndex += 1) {
    const span = spans[spanIndex];
    if (span.querySelector("svg")) {
      continue;
    }
    const text = span.textContent?.trim().toLowerCase() ?? "";
    if (CMF_SPONSORED_DICTIONARY.includes(text)) {
      return true;
    }
  }
  return false;
};

const isSponsoredShadowRoot1 = (post: HTMLElement, doc: Document): boolean => {
  const canvas = post.querySelector<HTMLCanvasElement>('a > span > span[aria-labelledby] > canvas');
  if (!canvas) {
    return false;
  }

  const elementId = canvas.parentElement?.getAttribute("aria-labelledby") ?? "";
  if (!elementId || !elementId.startsWith(":")) {
    return false;
  }

  const escaped = escapeIdForSelector(elementId);
  const span = doc.querySelector<HTMLElement>(`[id="${escaped}"]`);
  if (!span) {
    return false;
  }

  return CMF_SPONSORED_DICTIONARY.includes((span.textContent ?? "").trim().toLowerCase());
};

const isSponsoredShadowRoot2 = (post: HTMLElement, doc: Document): boolean => {
  const useElement = post.querySelector<SVGUseElement>('a > span > span[aria-labelledby] svg > use[*|href]');
  if (!useElement) {
    return false;
  }

  const elementId = useElement.href?.baseVal ?? "";
  if (!elementId || !elementId.startsWith("#")) {
    return false;
  }

  const textElement = doc.querySelector<HTMLElement>(elementId);
  if (!textElement) {
    return false;
  }

  return CMF_SPONSORED_DICTIONARY.includes((textElement.textContent ?? "").trim().toLowerCase());
};

const isSponsoredByLinkStructure = (post: HTMLElement): boolean => {
  let links = Array.from(
    post.querySelectorAll<HTMLAnchorElement>(
      `div[aria-posinset] span > a[href*="${SPONSORED_PARAM}"]:not([href^="/groups/"]):not([href*="section_header_type"])`
    )
  );

  if (!links.length) {
    links = Array.from(
      post.querySelectorAll<HTMLAnchorElement>(
        `div[aria-describedby] span > a[href*="${SPONSORED_PARAM}"]:not([href^="/groups/"]):not([href*="section_header_type"])`
      )
    );
  }

  if (!links.length) {
    links = Array.from(
      post.querySelectorAll<HTMLAnchorElement>(
        `a[href*="${SPONSORED_PARAM}"]:not([href^="/groups/"]):not([href*="section_header_type"])`
      )
    );
  }

  if (!links.length || links.length >= 10) {
    return false;
  }

  const maxIndex = Math.min(2, links.length);
  for (let index = 0; index < maxIndex; index += 1) {
    const href = links[index].href;
    const markerPos = href.indexOf(SPONSORED_PARAM);
    if (markerPos < 0) {
      continue;
    }
    if (href.slice(markerPos).length >= SPONSORED_MIN_PARAM_LENGTH) {
      return true;
    }
  }

  return false;
};

export const isSponsoredPost = (post: HTMLElement): boolean => {
  const doc = post.ownerDocument ?? getDefaultDocument();

  if (isSponsoredPlain(post)) {
    return true;
  }

  if (doc && isSponsoredShadowRoot1(post, doc)) {
    return true;
  }

  if (doc && isSponsoredShadowRoot2(post, doc)) {
    return true;
  }

  if (isSponsoredByLinkStructure(post)) {
    return true;
  }

  const aggregateText = `${post.textContent ?? ""} ${post.getAttribute("aria-label") ?? ""} ${post.getAttribute("title") ?? ""}`;
  return hasDictionaryToken(aggregateText, CMF_SPONSORED_DICTIONARY);
};

export const isReelsAndShortVideosPost = (post: HTMLElement): boolean => {
  const entryLink = post.querySelector('a[href="/reel/?s=ifu_see_more"]');
  if (entryLink) {
    return true;
  }

  const reels = post.querySelectorAll('a[href*="/reel/"]');
  if (reels.length > 4) {
    return true;
  }

  const buttonDiv = post.querySelector<HTMLElement>('div[role="button"] > i ~ div');
  const buttonText = buttonDiv?.textContent?.trim().toLowerCase() ?? "";
  return Boolean(buttonText && CMF_REELS_AND_SHORT_VIDEOS_DICTIONARY.includes(buttonText));
};

export const isShortReelVideoPost = (post: HTMLElement): boolean => {
  const reels = post.querySelectorAll('a[href*="/reel/"]');
  return reels.length === 1;
};

export const isSuggestedPost = (post: HTMLElement): boolean => {
  const suggestions = querySelectorAllNoChildren(
    post,
    [
      "div[aria-posinset] > div > div > div > div > div > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div > div:nth-of-type(2) > span > div > span:nth-of-type(1)",
      "div[aria-describedby] > div > div > div > div > div > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div > div:nth-of-type(2) > span > div > span:nth-of-type(1)"
    ],
    1
  );

  if (suggestions.length) {
    if (isReelsAndShortVideosPost(post)) {
      return false;
    }
    const firstChar = cleanText(suggestions[0].textContent ?? "").trim().slice(0, 1);
    return !DIGIT_PREFIX_PATTERN.test(firstChar);
  }

  return isGroupsYouMightLike(post);
};

export const isGroupsYouMightLike = (post: HTMLElement): boolean => {
  return post.querySelectorAll('a[href*="/groups/discover"]').length > 0;
};

export const isFollowPost = (post: HTMLElement): boolean => {
  const followBlocks = querySelectorAllNoChildren(
    post,
    [
      ":scope h4[id] > span > div > span",
      ":scope h4[id] > span > span > div > span",
      ":scope h4[id] > div > span > span[class] > div[class] > span[class]",
      ":scope h4[id] > span > span:nth-child(3) > span:nth-child(2) > div > span",
      ":scope h4[id] > span > span:nth-child(2) > span:nth-child(2) > div > span"
    ],
    0,
    false
  );

  return followBlocks.length === 1;
};

export const isParticipatePost = (post: HTMLElement): boolean => {
  const participateBlocks = querySelectorAllNoChildren(
    post,
    ':scope h4[id] > div[class] > span[dir] > span[class] > div[class] > span[class]',
    0
  );

  return participateBlocks.length === 1;
};

export const collectNewsFeedPosts = (container?: ParentNode): HTMLElement[] => {
  const scope = container ?? getDefaultDocument();
  if (!scope) {
    return [];
  }

  for (let queryIndex = 0; queryIndex < CMF_NEWS_FEED_POST_QUERIES.length; queryIndex += 1) {
    const query = CMF_NEWS_FEED_POST_QUERIES[queryIndex];
    const posts = Array.from(scope.querySelectorAll<HTMLElement>(query));
    if (posts.length) {
      return posts;
    }
  }

  return [];
};
