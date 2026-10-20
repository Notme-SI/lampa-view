export function localizedTitle(card,language='ru'){
 const existing=card.name || card.title || card.original_name || card.original_title || '';
 if(String(language).slice(0,2)!=='ru' || /[а-яё]/i.test(existing))return existing;
 const translations=card.translations && card.translations.translations || [];
 const translated=translations.find(t=>t.iso_639_1==='ru' && t.data && (t.data.name || t.data.title));
 if(translated)return translated.data.name || translated.data.title;
 const aliases=card.alternative_titles && (card.alternative_titles.results || card.alternative_titles.titles) || [];
 const valid=aliases.filter(t=>t.iso_3166_1==='RU' && typeof t.title==='string' && /[а-яё]/i.test(t.title) && !/season|сезон|part|часть/i.test(t.type || ''));
 const selected=valid.find(t=>!t.type) || valid[0];return selected?selected.title:existing;
}
export function isAnime(card){
 if(card.minimal_anime || card.source==='minimal_shiki' || card.shikimori_id || card.mal_id)return true;
 const animation=[...(card.genre_ids || []),...(card.genres || [])].some(g=>Number(g.id || g)===16);
 const keywords=card.keywords && (card.keywords.results || card.keywords.keywords) || [];
 return animation && (['ja','zh'].includes(card.original_language) || (card.origin_country || []).includes('JP') || keywords.some(k=>k.id===210024 || k.name==='anime'));
}
