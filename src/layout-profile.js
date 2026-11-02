// Shared presentation contract. No device or playback settings are changed.
const TV={small:{scale:1.12,posters:8,episodes:4},normal:{scale:1.34,posters:7,episodes:3},bigger:{scale:1.56,posters:6,episodes:2}};
const DESKTOP={small:{scale:1},normal:{scale:1.12},bigger:{scale:1.24}};
const MOBILE={small:{scale:.9},normal:{scale:1},bigger:{scale:1.05}};
export function layoutProfile(tv,size,mobile=false){const profiles=tv?TV:mobile?MOBILE:DESKTOP;return profiles[size] || profiles.normal;}
