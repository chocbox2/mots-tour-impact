// Load the map and the associated controls
function loadSongMap(data, field, container_ids) {
    const {countries, countrymesh, filtered_data, country_codes,  spotify_available, available_start_dates, smallCountries, tour_data, dates, song_list, spotify_info} = data
    const mapContainer = document.getElementById(container_ids.map)
    const chart = renderSongMapChart(data, field)
    mapContainer.appendChild(chart)

    // time scroller
    const controls = document.getElementById(container_ids.slider)
    let dateScroller = Scrubber(dates, 
        { autoplay: false, delay: 200, loop: false, format: d => (new Date(d)).toLocaleDateString("en-US", { timeZone: "UTC" })} 
    )
    controls.appendChild(dateScroller)
    dateScroller.i.addEventListener("input", () => {
        chart.setDate(dates[dateScroller.i.valueAsNumber])
    })

    // song selector 
    if (field !== "count") {
      const song_controls = document.getElementById(container_ids.selector)
      const songSelector = document.createElement("select")
      songSelector.style.width = "100%"
      song_list.forEach(title => {
          const option = document.createElement("option")
          option.value = title;
          option.textContent = title;
          songSelector.appendChild(option)
      })
      song_controls.appendChild(songSelector)
      songSelector.addEventListener("change", () => {
          const selectedSong = songSelector.value
          chart.setSong(selectedSong)
      })
    }

    // speed selector
    const speed_controls = document.getElementById(container_ids.speed)
    const speedSelector = document.createElement("select")
    speedSelector.style.width = "100%"
    const speeds = [1, 0.25, 0.5, 0.75, 1.5, 2]
    speeds.forEach(speed => {
      const option = document.createElement("option")
      option.value = speed
      option.textContent = `x${speed}`
      speedSelector.appendChild(option)
    })  
    speed_controls.appendChild(speedSelector)
    speedSelector.addEventListener("change", () => {
        const selected = speedSelector.value
        // get new delay
        controls.removeChild(dateScroller)
        const newScroller = Scrubber(dates, 
        { autoplay: false, delay: 200/selected, loop: false, format: d => (new Date(d)).toLocaleDateString("en-US", { timeZone: "UTC" })})
        controls.append(newScroller)
        newScroller.i.addEventListener("input", () => {
        chart.setDate(dates[dateScroller.i.valueAsNumber])})
        dateScroller = newScroller
        chart.setDuration(200/selected - 20)

      })
      
}



// Chart render function for the song map
function renderSongMapChart(data, field) {
  const {countries, countrymesh, filtered_data, country_codes,  spotify_available, available_start_dates, smallCountries, tour_data, dates, song_list, spotify_info} = data
  // Set the margins of the map
  const width = 1000;
  const marginTop = 60;
  const height = width / 2 + marginTop;
  let curr_title = song_list[0]
  let curr_date = dates[0]
  // Fit the projection within the margins
  const projection = d3.geoEqualEarth().fitExtent([[2, marginTop + 2], [width - 2, height]], {type: "Sphere"});
  const path = d3.geoPath(projection);

  let count_data;
  let color;
  let transition_duration = 250;
  if (field === "placement"){
    color = d3.scaleSequential(d3.extent(filtered_data.filter(d => d.region !== "global"), d => d[field]), t => d3.interpolateGnBu(1-t));
  }
  else if (field === "count") {
    const data = filtered_data.filter(x => x.region !== "global")
    .reduce((acc,item) => {
        acc[item.region + "~"+ item.chart_date] = (acc[item.region + "~" + item.chart_date] || 0) + 1;
      return acc;
      }, {})

    count_data = Object.entries(data).map(([key, count]) => {
      const [region, chart_date] = key.split("~")
      return {
          region,
          chart_date,
          count,
          id: country_codes[region.toUpperCase()]["num"]
      }
    })
    color = d3.scaleThreshold([2,3,4,6,8,10,20,40], d3.schemeYlGnBu[8]);
  }
  else {
    color = d3.scaleSequentialLog(d3.extent(filtered_data.filter(d => d.region !== "global"), d => d[field]), d3.interpolateGnBu);
  }

  // Create SVG container
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0,0, width,height])
    .attr("style", "max-width: 100%; height: auto;")

  // Add the title of the graph
  const title = svg.append("text")
    .attr("x", width/2)
    .attr("y", marginTop + 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("font-weight", "bold")
    .attr("fill", "black")
  
  // Create legend
  const color_legend = svg.append("g")
    .attr("transform", "translate(20,0)")
    .append(() => Legend(color, {title: field, width: 300, ticks: 3}))
  
  // Add "Not Available/Not Charting boxes"
  const not_available = svg.append("g")
    .attr("transform", "translate(350, 15)")
  not_available.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", "lightgray")
  not_available.append("text")
    .attr("font-size", "12px")
    .attr("x", 20)
    .attr("y", 12.5)
    .text("Not Charting in Top 200")
  const not_charting = svg.append("g")
    .attr("transform", "translate(510, 15)")
  not_charting.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", "darkgray")
  not_charting.append("text")
    .attr("font-size", "12px")
    .attr("x", 20)
    .attr("y", 12.5)
    .text("Spotify Charts Not Available")


  // Create background outline
  const bg = svg.append("path")
    .datum({type: "Sphere"})
    .attr("fill", "white")
    .attr("stroke", "currentColor")
    .attr("d", path)

  // Add each country's path, color according to data
  const country_fill = svg.append("g")
    .selectAll("path")
    .data(countries.features)
    .join("path")
    .attr("d", path)
  
  country_fill
      .append("title")

  // Add country borders
  const country_borders = svg.append("path")
    .datum(countrymesh)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("d", path)

  // Add circles for small countries
  const country_circles = svg.append("g")
  .selectAll("circle")
  .data(countries.features.filter(d => smallCountries.includes(d.id)))
  .join("circle")
  .attr("transform", d => `translate(${projection(d3.geoCentroid(d))})`) 
  .attr("r", 3)             
  .attr("stroke", "black")  
  
  country_circles
    .append("title")

  // add album cover image
  const image = svg.append("image")
    .attr("width", 150)
    .attr("height", 150)
    .attr("x", 80)
    .attr("y", height - 250)
  
  if (field !== "count") {
    image.attr("xlink:href", spotify_info[curr_title]?.["cover_image"])
  }

  // first update
  updateData(country_fill)
  updateData(country_circles)

  // function to update data as time goes on
  function setDate(new_date) {
      curr_date = new_date
      updateData()
  }

  // function to update song from selection choice
  function setSong(new_title) {
      curr_title = new_title
      image.attr("xlink:href", spotify_info[curr_title]?.["cover_image"])
      updateData()
  }

  //function to set transition duration
  function setDuration(new_duration) {
    duration = new_duration
  }
  // function that updates the text/fill of countries as changes happen
  function updateData() {
      if (field === "count") {
        title.text(`Charting Song Count on ${(new Date(curr_date)).toLocaleDateString("en-US", { timeZone: "UTC" })}`)
      }
      else {
        title.text(`${curr_title} ${field} on ${(new Date(curr_date)).toLocaleDateString("en-US", { timeZone: "UTC" })}`)
      }
      let curr_focus_data
      if (field === "count") {
        curr_focus_data = count_data
        .filter(x => x.chart_date === curr_date)
        .map(item => ({
          ...item,
          id: country_codes[item.region.toUpperCase()]["num"]
        }))
      }
      else {
        curr_focus_data = filtered_data
          .filter(x =>x.title ===curr_title)
          .filter(x=> x.region !== "global")
          .filter(x => x.chart_date === curr_date)
          .map(item => ({
            ...item,
            id: country_codes[item.region.toUpperCase()]["num"]
          }))
      }
      const curr_val_map = new Map(curr_focus_data.map(d => [d.id, d[field]]));
      function updateFill(selection) {
        selection
        .transition()
        .duration(transition_duration)
        .attr("fill", d => {
              const data = curr_val_map.get(d.id)
              if (data != null) {
                return color(data)
              }
              if (spotify_available.includes(d.id)) {
                if (d.id in available_start_dates && available_start_dates[d.id] > new Date(curr_date)) {
                  return "darkgray"
                }
                return "lightgray"
              }
              else {
                return "darkgray"
              }
            })
        .select("title")
        .text(d => {const data = curr_val_map.get(d.id)
              if (data != null) {
                return `${d.properties.name}\n${curr_val_map.get(d.id)}`
              }
              if (spotify_available.includes(d.id)) {
                if (d.id in available_start_dates && available_start_dates[d.id] > new Date(curr_date)) {
                   return `${d.properties.name}\nData Not Available`
                }
                return `${d.properties.name}\nNot Charting`
              }
              else {
                return `${d.properties.name}\nData Not Available`
              }
                   
          })
      }
      updateFill(country_fill)
      updateFill(country_circles)
  }
  if (field === "count") {
    return Object.assign(svg.node(), {setDate, setDuration});
  }
  else {
    return Object.assign(svg.node(), {setDate, setSong, setDuration});
  }
  
}