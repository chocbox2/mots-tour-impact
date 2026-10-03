function loadGlobalStreams(data, container_ids) {
    const  {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors}     = data
    // global legend
    const global_legendContainer= document.getElementById(container_ids.global_legend) 
    const global_legend = albumLegend(album_colors)
    global_legendContainer.append(global_legend)

    // donut graph
    const donut_container= document.getElementById(container_ids.global_legend) 
    let donut_graph = renderDonutChart(data,"Yellow","2026-03-03")
    donut_container.append(donut_graph)
    
    // global stream graph
    const global_graphContainer = document.getElementById(container_ids.graph)
    const global_graph = renderLineGraph(data, "streams", "global")
    global_graphContainer.appendChild(global_graph)
    global_graph.addEventListener("input", (event) => {
        const point = event.target.value;
        if (!point) {
            return
        }

        const title = point.title
        const date = point.date.toISOString().split("T")[0]

        if (donut_graph) {
            donut_graph.remove()
        }

        donut_graph = renderDonutChart(data,title, date)
        donut_container.append(donut_graph)
    })

    // field switch listener
    const field_switch = document.getElementById(container_ids.switch)
    field_switch.addEventListener("change", () => {
        const selected_field = field_switch.value
        global_graph.updateField(selected_field)
    })
}

function renderDonutChart(data, curr_title, curr_date) {
  const  {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors}     = data
  const width = 500
  const height = 500
  const radius = 250;
  
  const arc = d3.arc()
      .innerRadius(radius * 0.67)
      .outerRadius(radius - 1);

  const pie = d3.pie()
      .padAngle(1 / radius)
      .sort(null)
      .value(d => d["streams"]);
  
  // get the data for the chosen donut graph
  const curr_data = filtered_data.filter(d => d.title === curr_title).filter(d => new Date(d.chart_date).toISOString().split("T")[0]=== curr_date)
  const otherStreams = curr_data.filter(x => x.region !== "global").reduce((sum,d) => sum + d.streams,0)
  const globalEntry = curr_data.find(x => x.region === "global")
  const otherEntry = {
    ...globalEntry,
    region: "other",
    streams: globalEntry?.streams  - otherStreams,
    placement: 0
  }
  const graph_data =  [...curr_data, otherEntry].filter(x => x.region !== "global")
  graph_data.sort((a,b) => b.streams - a.streams)

  const all_regions = new Set(filtered_data.map(d => d.region))
  all_regions.add("Other")
  const color = d3.scaleOrdinal()
      .domain([...all_regions].sort())
      .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), all_regions.size).reverse());

  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto;");
  
  // create the pie chart arcs
  svg.append("g")
    .selectAll()
    .data(pie(graph_data))
    .join("path")
      .attr("fill", d => color(d.data.region))
      .attr("d", arc)
    .append("title")
      .text(d => `${countries.features.find(en => en.id === (country_codes[d.data.region.toUpperCase()]?.["num"] || "N/A"))?.properties["name"] || "Other"}: #${d.data["placement"] || "N/A"} | ${d.data["streams"].toLocaleString()}`);

  // append text
  svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 12)
      .attr("text-anchor", "middle")
    .selectAll()
    .data(pie(graph_data))
    .join("text")
      .attr("transform", d => `translate(${arc.centroid(d)})`)
      .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.05).append("tspan")
          .attr("y", "0em")
          .attr("font-weight", "bold")
          .text(d => d.data.region))
      .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
          .attr("x", 0)
          .attr("y", "1.2em")
          .attr("fill-opacity", 0.7)
          .text(d => `#${d.data["placement"] || "N/A"} | ${d.data["streams"].toLocaleString()}`));
  // add image to center
  const image = svg.append("image")
    .attr("width", 150)
    .attr("height", 150)
    .attr("x", "-75")
    .attr("y", "-75")
    .attr("xlink:href", spotify_info[curr_title]?.["cover_image"])

  // add text to center
  const centerText = svg.append("text")
    .attr("y", "-110")
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("font-weight", "bold")
    .attr("fill", "black")

    const song_title_display = centerText
      .append("tspan")
      .attr("dy", "0em")
      .text(curr_title)
  
    const date_display = centerText
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "1.2em")
      .text(curr_date)

    const global_display = centerText
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "9.25em")
      .text(`#${globalEntry?.placement} | ${globalEntry?.streams.toLocaleString()} streams`)

  return svg.node();
}