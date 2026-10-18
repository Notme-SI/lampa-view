-- Run inside a real mpv process; assertions are offline and do not open media.
local real_mp=mp
local utils=require 'mp.utils'
local root=mp.get_opt('lampa_view-test-config') or mp.command_native({'expand-path','~~/'})
local getenv=os.getenv
local payload
local props={path='http://host/stream?link=abcdef&index=1&play',['media-title']='stream'}
local function current(data,raw)
    payload=data
    local M=dofile(root..'/extensions/lampa_context.lua')
    return M.current(raw)
end
local base={title='Во все тяжкие',original_title='Breaking Bad',kind='tv',tmdb_id=1396,imdb_id='tt0903747',season=2,episode=3}
local entry={version=1,source='lampa',entries={{url=props.path,identity=base}}}
local function copy(value) return utils.parse_json(utils.format_json(value)) end
local function run()
    mp=setmetatable({get_property=function(k,d) return props[k] or d end},{__index=real_mp})
    os.getenv=function(key) if key=='MPV_PLUS_LAMPA_CONTEXT' then return payload and utils.format_json(payload) end;return getenv(key) end
    local a=current(entry)
    assert(a.title=='Во все тяжкие' and a.tmdb_id==1396 and a.season==2 and a.episode==3)
    props.path='edl://!new_stream;%'..#entry.entries[1].url..'%'..entry.entries[1].url
    a=current(entry);assert(a.episode==3 and a.season==2,'EDL wrapper lost the exact episode')
    props.path='http://other/video.mkv'
    assert(current(entry)==nil,'card identity leaked to unrelated media')
    props.path='http://host/stream?link=abcdef&index=2&play'
    a=current(entry,'Breaking.Bad.S03E06.mkv')
    assert(a.title=='Во все тяжкие' and a.season==3 and a.episode==6,'sibling inherited initial episode')
    a=current(entry,'stream')
    assert(a.episode==nil and a.season==nil,'unknown episode defaulted to the previous one')
    props.path=entry.entries[1].url
    local unknown=copy(entry);unknown.entries[1].identity.episode=nil;unknown.entries[1].identity.season=nil
    a=current(unknown);assert(a.kind=='tv' and not a.episode and not a.season)
    local special=copy(entry);special.entries[1].identity.season=0
    assert(current(special).season==0)
    local anime=copy(entry);anime.entries[1].identity={title='Дандадан',original_title='Dandadan',kind='tv',anime=true,tmdb_id=240411,season=1,episode=4,mal_id=57334}
    a=current(anime);assert(a.anime and tonumber(a.mal_id)==57334 and a.tmdb_episode==4)
    local jp=copy(entry);jp.entries[1].identity={title='カウボーイビバップ',original_title='カウボーイビバップ',kind='tv',anime=true,tmdb_id=30991,season=1,episode=5}
    a=current(jp);assert(tonumber(a.mal_id)==1,'TMDB mapping did not resolve Japanese-only title')
    local invalid=copy(entry);invalid.version=2;assert(current(invalid)==nil)
    payload=nil;assert(current(nil)==nil,'standalone media unexpectedly received Lampa identity')
    real_mp.msg.info('LAMPA_VIEW_CONTEXT_OK: 11 scenarios')
end
local ok,err=xpcall(run,debug.traceback)
mp=real_mp;os.getenv=getenv
if not ok then real_mp.msg.error('LAMPA_VIEW_CONTEXT_FAILED: '..tostring(err)) end
real_mp.commandv('quit',ok and 0 or 1)
