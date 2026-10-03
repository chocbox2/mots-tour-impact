
function loadTourMap(data, container_ids) {
    const  {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors}     = data
    const tourContainer = document.getElementById(container_ids.map)
    const width = tourContainer.clientWidth
    const chart = renderTourMap(data, width)
    tourContainer.appendChild(chart)

    // line graph to the side for streams/placement
    const stream_graphContainer = document.getElementById(container_ids.stream_graph)
    const stream_graph = renderLineGraph(data, "streams", "regional")
    stream_graphContainer.appendChild(stream_graph)

    // for position
    const placement_graphContainer = document.getElementById(container_ids.placement_graph)
    const placement_graph = renderLineGraph(data, "placement", "regional")
    placement_graphContainer.appendChild(placement_graph)

    // time scroller
    const controls = document.getElementById(container_ids.slider)
    const dateScroller = Scrubber(tour_dates_list, 
        { autoplay: false, delay: 1000, loop: false, format: d => (new Date(d)).toLocaleDateString("en-US", { timeZone: "UTC" })} 
    )
    controls.appendChild(dateScroller)
    dateScroller.i.addEventListener("input", () => {
        chart.updateMap(tour_dates_list[dateScroller.i.valueAsNumber])
        stream_graph.updateTourDate(tour_dates_list[dateScroller.i.valueAsNumber])
        placement_graph.updateTourDate(tour_dates_list[dateScroller.i.valueAsNumber])
    })

    // legend
    const legendContainer= document.getElementById(container_ids.legend) 
    const legend = albumLegend(album_colors)
    legendContainer.append(legend)
    
}

function renderTourMap(data, container_width) {
    const  {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors}     = data
    
    const title_margin = 100
    const height = Math.min(500, container_width) + title_margin
    const width = Math.min(500, container_width)
    const dpr = window.devicePixelRatio 
    const canvas = d3.create("canvas")
        .attr("width", dpr*width)
        .attr("height", dpr*height)
        .style("width", `${width}px`)
        .attr("style", "max-width: 100%; height: auto;")
    const context = canvas.node().getContext("2d");
    context.scale(dpr, dpr);

    const projection = d3.geoOrthographic().fitExtent([[10, 10], [width - 10, height - 10]], {type: "Sphere"});
    const path = d3.geoPath(projection, context);
    const tilt = 20;
    function render(city, country, arc, title, subtitle) {
        context.clearRect(0, 0, width, height);
        // Title
        context.fillStyle = "#000"
        context.font = "bold 20px Times New Roman"
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(title, width/2, 20)
        context.font = "bold 14px Times New Roman"
        context.fillText(subtitle, width/2, 40)
        // Globe
        context.beginPath(), path(landmesh), context.fillStyle = "#ccc", context.fill();
        context.beginPath(), path(country), context.fillStyle = "red", context.fill();
        context.beginPath(), path(countrymesh), context.strokeStyle = "#fff", context.lineWidth = 0.5, context.stroke();
        context.beginPath(), path({type: "Sphere"}), context.strokeStyle = "#000", context.lineWidth = 1.5, context.stroke();
        context.beginPath(), path(arc), context.stroke();

        
        // Cities on the Globe
        // draw all gray cities
        const center = projection.invert([width / 2, height / 2]);
        let highlight_city = null;
        cities.forEach(c => {
            if (c.city === city) {
              highlight_city = c
            }
            if (d3.geoDistance(c.coords, center) < Math.PI/2) {
              const [x, y] = projection(c.coords)
              context.beginPath();
              context.arc(x,y,2.5,0,2*Math.PI)
              context.fillStyle = "gray"
              context.fill();
            }
        })
        // draw highlight city at end
        if (highlight_city) {
          const [x, y] = projection(highlight_city.coords)
          context.beginPath();
          context.arc(x,y,2.5,0,2*Math.PI)
          context.fillStyle="blue"
          context.fill();
        }
        return context.canvas;
    }
    
    let p1, p2 = [0, 0], r1, r2 = [0, 0, 0];
    updateMap(tour_dates_list[0]) // start at first date
    function updateMap(selectedDate) {
        const stop = tour_countries.find(d => new Date(d.Date).toISOString() === new Date(selectedDate).toISOString());
        if (stop) {
        let city = stop.City
        let country = stop.country_render
        let name = country.properties.name;
        const title = `${stop.City}, ${name} on ${stop.Date}`
        const revenue = stop.Revenue !== 0 ?  stop.Revenue.toLocaleString() : "N/A"
        const attendance = stop.Attendance !== 0 ? stop.Attendance.toLocaleString() : "N/A"
        const subtitle = `${stop.Venue} | Revenue: $${revenue} | Attendance: ${attendance}`

        p1 = p2, p2 = [stop.longitude, stop.latitude];
        r1 = r2, r2 = [-p2[0], tilt - p2[1], 0];
        const ip = d3.geoInterpolate(p1, p2);
        const iv = Versor.interpolateAngles(r1, r2);

        d3.transition()
            .duration(400)
            .tween("render", () => t => {
            projection.rotate(iv(t));
            render(city, country, {type: "LineString", coordinates: [p1, ip(t)]}, title, subtitle);
            })
        .transition()
            .tween("render", () => t => {
            render(city, country, {type: "LineString", coordinates: [ip(t), p2]}, title, subtitle);
            })
        }
    }
        return Object.assign(canvas.node(), {updateMap});
}

// render the line graph for songs
function renderLineGraph(data, field, type) {
  const  {countries, country_codes, landmesh, countrymesh, cities,  available_start_dates, tour_countries, tour_dates_list, filtered_data,spotify_info, album_colors}      = data
  const width = (type === "global") ? 1200:600;
  const height = (type === "global") ? 600: 300;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 30;
  const marginLeft = 30;
  const lineWidth = (type === "global") ? 3:2;
  let points = []
  let curr_x_scale = null;
  let x = null;
  let y = null;
  let [start_date, end_date] = d3.extent(filtered_data.map(d => new Date(d.chart_date)))

  // zoom function
  const zoom_behavior = d3.zoom()
        .scaleExtent([1, 400])
        .translateExtent([[marginLeft, marginTop], [width - marginRight, height - marginTop]])
        .extent([[marginLeft, marginTop], [width - marginRight, height - marginTop]])
        .on("zoom", zoomed);
  
  // Color scales
  const titles = Array.from(new Set(filtered_data.map(d => d.title)))
  
  // SVG Container
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0,0, width, height])
    .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;")

  if (type === "global") {
    svg.call(zoom_behavior)
  }
  
  
  // x and y axis
  const x_axis = svg.append("g").attr("transform", `translate(0,${height - marginBottom})`)
  const y_axis = svg.append("g").attr("transform", `translate(${marginLeft},0)`)
  y_axis.append("text")
      .attr("x", -marginLeft)
      .attr("y", 10)
      .attr("fill", "black")
      .attr("text-anchor", "start")
      .text(field);

  // clip path
  const clip = svg.append("defs").append("clipPath")
        .attr("id", `clip${type}`)
        .append("rect")
        .attr("width", width - marginLeft - marginRight )
        .attr("height", height - marginTop - marginBottom )
        .attr("x", marginLeft)
        .attr("y", marginTop);

  // Path Groups
  const path = svg.append("g")
    .attr("clip-path", `url(#clip${type})`)
    .attr("fill", "none")
    .attr("stroke-width", lineWidth)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
  
  // interactive tooltips
  const dot = svg.append("g")
    .attr("display", "none")
  dot.append("circle").attr("r", 2.5)
  dot.append("text").attr("text-anchor", "middle").attr("y", -8)

  const dotImage = svg.append("image")
    .attr("width", 30)
    .attr("height",30)
    .attr("x", -15)
    .attr("y", -50)

  // Listeners
  svg
    .on("pointerenter", pointerentered)
    .on("pointermove", pointermoved)
    .on("pointerleave", pointerleft)
    .on("touchstart", event => event.preventDefault())

  if (type === "regional") {
    updateTourDate(tour_dates_list[0])
  }
  else {
    updateLineGraph("global", start_date, end_date)
  }

  // callback to update the tour date
  function updateTourDate(selectedDate) {
      // find the tour stop and set the region accordingly
      let tour_stop = tour_countries.find(d => new Date(d.Date).toISOString().split("T")[0] === new Date(selectedDate).toISOString().split("T")[0])
      if (!tour_stop) {
        return 
      }
      const region = tour_stop.country_code.toLowerCase()
    
      // calculate days for intial zoom
      let target = new Date(selectedDate)
      let start_date = new Date(target)
      start_date.setUTCDate(target.getUTCDate() - 7)
      let end_date = new Date(target)
      end_date.setUTCDate(target.getUTCDate() + 7)
      updateLineGraph(region, start_date, end_date)
    
  }
  
  // callback to toggle the field 
  function updateField(new_field) {
    field = new_field
    y_axis.select("text").text(field)
    updateLineGraph("global", start_date, end_date)
  }

  // callback to update the line graph
  function updateLineGraph(region, start_date, end_date) {
      dot.attr("display", "none")
      dotImage.attr("display", "none") // clear the dot selection

      const date_filtered = filtered_data.filter(d => d.region === region).filter(d => {
        const date = new Date(d.chart_date).toISOString().split("T")[0]
        return date >= start_date.toISOString().split("T")[0] && date <= end_date.toISOString().split("T")[0];
      })
    
      // x and y scales
      x = d3.scaleUtc()
          .domain([start_date, end_date])
          .range([marginLeft, width - marginRight])
      let domain = []
      if (field === "placement") {
        domain= [200, 1]
      }
      else {
        domain = [0, d3.max(date_filtered, d => d[field])]
      }
      curr_x_scale = x
      y = d3.scaleLinear()
      .domain(domain)
      .range([height - marginBottom, marginTop])
      .nice();

      // Update axes
      x_axis.transition().call(d3.axisBottom(x).tickSizeOuter(0));
      y_axis.transition().call(d3.axisLeft(y))

     // add missing dates to leave blank spots in the data and create the points array
      const date_range = d3.utcDay.range(start_date, d3.utcDay.offset(end_date, 1))
      const grouped_data = d3.group(date_filtered, d => d.title)
      const filled_data = titles.map(title => {
        const curr_data = grouped_data.get(title) || []
        const data_map = new Map(curr_data.map(d => [new Date(d.chart_date).toISOString().split("T")[0],d]))
        const points = date_range.map(date => {
            const date_str = date.toISOString().split("T")[0]
            const data = data_map.get(date_str)
          return [date, data ? data[field] : undefined, title, spotify_info[title]["album"]]
        })
        return points
      })

      // Draw lines
      points = filled_data.flat().map(([date, v, title, album]) => ({date: date, v: v, title: title,album: album}))
      const groups =d3.rollup(points, v => Object.assign(v, {title: v[0].title, album: v[0].album}), d => d.title);
      const line = d3.line()
      .defined(d => d.v != undefined)
      .x(d => x(d.date))
      .y(d => y(d.v))
      path
        .selectAll("path")
        .data(groups.values())
        .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("stroke", d => album_colors[d.album] || "red")
        .attr("d", line);

    }
    if (type === "regional") {
      return Object.assign(svg.node(), {updateTourDate})
    }
    else {
      return Object.assign(svg.node(), {updateField})
    }
    

    // zoom update function
    function zoomed(event) {
      // update x scale
      curr_x_scale = event.transform.rescaleX(x)
      x_axis.transition().call(d3.axisBottom(curr_x_scale).tickSizeOuter(0))
  
      // calculate visible points and scale y axis down to the max
      const [x0, x1] = curr_x_scale.domain()
      const visible_points = points.filter(d => d.v !== undefined && d.date >= x0 && d.date <= x1)
      const new_y_max = d3.max(visible_points, d => d.v) || 0
      if (field !== "placement") {
        y.domain([0, new_y_max]).nice()
        y_axis.transition().call(d3.axisLeft(y))
      }

      // draw lines
      const newLine = d3.line()
      .defined(d => d.v != undefined)
      .x(d=> curr_x_scale(d.date)).y(d => y(d.v))
      
      path.selectAll("path")
        .attr("d", newLine)
      dot.attr("transform", event.transform)
      dotImage.attr("transform", event.transform)
    }
    // pointer functions
    function pointermoved(event) {
      if (points.length === 0 || points.every(p => p.v === undefined)) {
          return;
      }
      const [xm, ym] = d3.pointer(event);
      const i = d3.leastIndex(points, d => Math.hypot(curr_x_scale(d.date) - xm, y(d.v) - ym));
      if (i === -1) {
        return
      }
      const curr = points[i];
      path.selectAll("path").style("stroke", d => curr.title === d.title ? null : "#ddd")
        .filter(d => d.title === curr.title).raise();

      // update the dot and the image on the dot
      dot.attr("display", null);
      dot.attr("transform", `translate(${curr_x_scale(curr.date)},${y(curr.v)})`);
      dot.select("text").text(`${curr.title}: ${curr.v.toLocaleString()}`);
      
      dotImage.attr("display", null);
      dotImage
        .attr("xlink:href", spotify_info[curr.title].cover_image)
        .attr("transform", `translate(${curr_x_scale(curr.date)},${y(curr.v)})`);
      
      svg.property("value", points[i]).dispatch("input", {bubbles: true});
    }
  
    function pointerentered() {
      if (points.length === 0 || points.every(p => p.v === undefined)) {
          return;
      }
      path.selectAll("path").style("mix-blend-mode", null).style("stroke", "#ddd");
      dot.attr("display", null);
      dotImage.attr("display", null);
    }
  
    function pointerleft() {
      if (points.length === 0 || points.every(p => p.v === undefined)) {
          return;
      }
      path.selectAll("path").style("mix-blend-mode", "multiply").style("stroke", null);
      dot.attr("display", "none");
      dotImage.attr("display", "none")
      svg.node().value = null;
      svg.dispatch("input", {bubbles: true});
    }
}

// Legend for the album colors, like the in-class tutorial legend
function albumLegend(album_colors) {
  const titlePadding = 15;  // padding between title and entries
  const entrySpacing = 16;  // spacing between legend entries
  const entrySize = 10;    // size of legend entry marks
  const labelOffset = 4;    // additional horizontal offset of text labels
  const baselineOffset = 9; // text baseline offset, depends on radius and font size
  const albums = Object.keys(album_colors).concat(["Other"])
  const colors_list = Object.values(album_colors).concat(["red"])
  const color = d3.scaleOrdinal(albums, colors_list)

  const container = d3.create('svg')
    .attr('width', 150)
    .attr('height', 190);

  const title = container.append('text')
    .attr('x', 0)
    .attr('y', 10)
    .attr('fill', 'black')
    .attr('font-family', 'Helvetica Neue, Arial')
    .attr('font-weight', 'bold')
    .attr('font-size', '12px')
    .text('Album');

  const entries = container.selectAll('g')
    .data(albums)
    .join('g')
      .attr('transform', d => `translate(0, ${titlePadding + albums.indexOf(d) * entrySpacing})`);

  const symbols = entries.append('rect')
    .attr('width', entrySize)
    .attr('height', entrySize)
    .attr('fill', d => color(d));

  const labels = entries.append('text')
    .attr('x', 2 * entrySize / 2 + labelOffset) // <-- place labels to the left of symbols
    .attr('y', baselineOffset) // <-- adjust label y-position for proper alignment
    .attr('fill', 'black')
    .attr('font-family', 'Helvetica Neue, Arial')
    .attr('font-size', '11px')
    .style('user-select', 'none') // <-- disallow selectable text
    .text(d => d);

    return container.node()
}


// class from Observable to calculate angles: https://observablehq.com/@d3/world-tour
class Versor {
  static fromAngles([l, p, g]) {
    l *= Math.PI / 360;
    p *= Math.PI / 360;
    g *= Math.PI / 360;
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg
    ];
  }
  static toAngles([a, b, c, d]) {
    return [
      Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * 180 / Math.PI,
      Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * 180 / Math.PI
    ];
  }
  static interpolateAngles(a, b) {
    const i = Versor.interpolate(Versor.fromAngles(a), Versor.fromAngles(b));
    return t => Versor.toAngles(i(t));
  }
  static interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    a2 -= a1, b2 -= b1, c2 -= c1, d2 -= d1;
    const x = new Array(4);
    return t => {
      const l = Math.hypot(x[0] = a1 + a2 * t, x[1] = b1 + b2 * t, x[2] = c1 + c2 * t, x[3] = d1 + d2 * t);
      x[0] /= l, x[1] /= l, x[2] /= l, x[3] /= l;
      return x;
    };
  }
  static interpolate([a1, b1, c1, d1], [a2, b2, c2, d2]) {
    let dot = a1 * a2 + b1 * b2 + c1 * c2 + d1 * d2;
    if (dot < 0) a2 = -a2, b2 = -b2, c2 = -c2, d2 = -d2, dot = -dot;
    if (dot > 0.9995) return Versor.interpolateLinear([a1, b1, c1, d1], [a2, b2, c2, d2]); 
    const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
    const x = new Array(4);
    const l = Math.hypot(a2 -= a1 * dot, b2 -= b1 * dot, c2 -= c1 * dot, d2 -= d1 * dot);
    a2 /= l, b2 /= l, c2 /= l, d2 /= l;
    return t => {
      const theta = theta0 * t;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      x[0] = a1 * c + a2 * s;
      x[1] = b1 * c + b2 * s;
      x[2] = c1 * c + c2 * s;
      x[3] = d1 * c + d2 * s;
      return x;
    };
  }
}
