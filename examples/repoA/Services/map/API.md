# GET /__tile__/:theme/:version/:type/:z/:x/:y

Fetch a tile

|         |                                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| theme   | Name of the theme, such as `Water.Pipe Diameter`                                                                                                                                                                         |
| version | Tile version. This is used by the tile cache to know when a tile has changed. If you do not know the version, then you can use `0` as the version, but then you can't be guaranteed to have fresh tiles when the data changes |
| type    | Either `png` or `jpg`                                                                                                                                                                                                         |
| z       | Tile level. See [Tile Coordinates](http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/) for details. Tiles here use the Google scheme.                                                                    |
| x       | Tile X                                                                                                                                                                                                                        |
| y       | Tile Y                                                                                                                                                                                                                        |

# POST /modify_theme/:theme

Create or update a map theme.
The JSON describing the map theme must be sent in the body of the request.
