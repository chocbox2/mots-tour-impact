const files = [
    "data/coldplay_data.json",
    "data/countries-50m.json",
    "data/ISO-3166-ID-CURATED-ALPHA2.json",
    "data/spotify_countries.json",
    "data/startdates.json",
    "data/tour_dates_data.json",
    "data/coldplay_spotify_info.json",
    "data/album_colors.json"
]

Promise.all(files.map(file => d3.json(file))) // load all the data needed
.then(([stream_data, world_data, country_codes, spotify_countries, available, tour_data, spotify_info, album_colors]) => {
    // Create TopoJson arrays
    const countries = topojson.feature(world_data, world_data.objects.countries)
    const countrymesh = topojson.mesh(world_data, world_data.objects.countries)
    const landmesh = topojson.feature(world_data, world_data.objects.land)
    // Array of all countries where spotify charts are available
    const spotify_available = spotify_countries.map(item => (country_codes[item.toUpperCase()]["num"])) 
    // Array for when countries started being available, if not default
    const available_start_dates = Object.fromEntries(Object.entries(available).map(([r, d]) => {
        return [country_codes[r.toUpperCase()]["num"], new Date(d)]}))
    // Cleaning up an edge case inconsistency (these two should be the same song)
    const filtered_data = stream_data.map(item => {
        if(item.title === "WE PRAY - Single Version") return {...item, title: "WE PRAY"};
        if(item.title === "feelslikeimfallinginlove - Single Version") return {...item, title: "feelslikeimfallinginlove"};
        return item;
    })
    // add additional info 
    .map(item => {
    const info = spotify_info[item.title]
    return {
        ...item,
        credits: info["credits"],
        total_streams: info["streams"],
        album: info["album"],
        image_link :info["cover_image"]
        }
    }
    )
    // Array of the small countries that need to be shown
    const smallCountries = countries.features.filter(d => d3.geoArea(d) < 1e-4).map(d => d.id).filter(d => spotify_available.includes(d)).filter(d => d!== "036");
    // Array of all dates where there are charts, sorted
    const dates = Array.from(new Set(filtered_data.map(d => d.chart_date))).sort((a,b) => new Date(a) - new Date(b))
    // Array of all songs that need to be shown
    const song_list = Object.entries(spotify_info).sort((a,b) => b[1]["streams"]- a[1]["streams"]).map(d => d[0])
    
    // Set of all cities and their coords unique
    let cities_set = new Set(tour_data.map(d => JSON.stringify([d.City,d.longitude, d.latitude])))
    const cities = Array.from(cities_set).map(item => {
        const [city, longitude, latitude] = JSON.parse(item)
        return {city, coords: [longitude, latitude]}
    })
    // Tour data with country renders added on
    const tour_countries = tour_data.map(d => ({
      ...d,
      id: country_codes[d.country_code]["num"] , 
      country_render: countries.features.find(x =>country_codes[d.country_code]["num"] === x.id )
    }))
    // All tour dates
    const tour_dates_list = tour_data.map(d => new Date(d.Date + "T00:00:00.000Z")).sort((a,b) => a - b)
      
    // song stream/placement maps
    const song_map_data = {countries, countrymesh, filtered_data, country_codes,  spotify_available, available_start_dates, smallCountries, tour_data, dates, song_list, spotify_info}
    loadSongMap(song_map_data, "placement", {map: "placement-map-container", slider: "placement-map-slider", selector: "placement-map-selection", speed: "placement-speed-selector"})
    loadSongMap(song_map_data, "streams", {map: "stream-map-container", slider: "stream-map-slider", selector: "stream-map-selection",speed: "stream-speed-selector"})
    loadSongMap(song_map_data, "count", {map: "count-map-container", slider: "count-map-slider", selector: "", speed: "count-speed-selector"})

    // tour globe map
    const tour_map_data = {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors} 
    loadTourMap(tour_map_data, {map: "tour-map-container", slider: "tour-map-slider", stream_graph: "tour-stream-graph-container", 
        placement_graph: "tour-placement-graph-container", legend:"album-legend"})
    
    loadGlobalStreams(tour_map_data,{graph: "global-stream-graph", global_legend: "global-stream-legend", switch: "field-switch", donut: "donut-graph"})

  })


