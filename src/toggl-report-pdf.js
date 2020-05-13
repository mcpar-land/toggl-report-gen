require('dotenv-flow').config()
const TogglClient = require('toggl-api')
const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')
const moment = require('moment')
require('moment-duration-format')(moment)
const Color = require('color')
const { inspect } = require('util')

const { getConfig, updateConfig } = require('./config')

console.log(inspect(getConfig(), false, 999, true))

const toggl = new TogglClient({
	apiToken: process.env.TOGGL_API_KEY,
})

const generate = (range = 'week') => {
	const STARTING_TIME = moment().startOf(range)
	const ENDING_TIME = moment().endOf(range)

	toggl.getClients((err, res) => {
		const config = getConfig()
		for (const client of res) {
			config[client.id] = {
				name: client.name,
				report: (config[client.id] && config[client.id].report) || null,
				email: (config[client.id] && config[client.id].email) || null,
			}

			for ([k, v] of Object.entries(config[client.id])) {
				if (v === null)
					console.warn(`Value ${k} not set for client ${client.id}`)
			}

			toggl.summaryReport(
				{
					client_ids: client.id,
					workspace_id: client.wid,
					since: STARTING_TIME.toISOString(),
					until: ENDING_TIME.toISOString(),
				},
				(err, report) => {
					if (err) console.error(err)
					generatePdf({ client, report })
				}
			)
		}
		updateConfig(config)
	})

	const toDuration = (time) => moment.duration(time).format('HH[h] mm[m]')

	const TEXT_COLOR = 'black'
	const LINK_COLOR = 'darkblue'

	const generatePdf = ({ client, report }) => {
		console.log(`Generating report for client ${client.name} (${client.id})`)

		// console.log(inspect({ client, report }, false, 999, true))

		const fileDateFormat = 'MM-DD-YY'
		const clientFileName = client.name.replace(' ', '_')
		// const fileName =
		// 	clientfileName +
		// 	'_(' +
		// 	STARTING_TIME.format(fileDateFormat) +
		// 	'_' +
		// 	ENDING_TIME.format(fileDateFormat) +
		// 	').pdf'
		fileName = clientFileName + '.pdf'

		const filePath = path.join(__dirname + `/../files/${fileName}`)
		const doc = new PDFDocument({
			margin: 45,
		})

		doc.pipe(fs.createWriteStream(filePath))

		doc.registerFont('light', 'fonts/OverpassMono-Light.ttf')
		doc.registerFont('regular', 'fonts/OverpassMono-Regular.ttf')
		doc.registerFont('semibold', 'fonts/OverpassMono-SemiBold.ttf')
		doc.registerFont('bold', 'fonts/OverpassMono-Bold.ttf')
		doc.font('light')
		doc.fillColor(TEXT_COLOR)

		const totalBilled = report.total_currencies[0]
			? report.total_currencies[0].amount
			: 0.0

		const config = getConfig()

		doc
			.fontSize(12)
			.font('light')
			.fillColor(TEXT_COLOR)
			.text('john mcparland', 0, doc.page.margins.top, {
				align: 'right',
			})
			.fillColor(LINK_COLOR)
			.text('john@mcpar.land', {
				link: 'http://mcpar.land',
				align: 'right',
				underline: true,
			})
			.fillColor(LINK_COLOR)
			.text('713.504.0127', {
				link: 'sms:7135040127',
				align: 'right',
				underline: true,
			})
			.fillColor(TEXT_COLOR)

		const dateFormat = 'MMMM Do YYYY'

		doc
			.fontSize(26)
			.text(client.name, doc.page.margins.left, doc.page.margins.top)
			.fontSize(10)
			.text(
				`   Billing for: ${STARTING_TIME.format(
					dateFormat
				)} - ${ENDING_TIME.format(dateFormat)}`
			)
			.fontSize(14)
			.moveDown(1)
			.text(`Total time: `, { continued: true })
			.font('bold')
			.text(`${toDuration(report.total_grand)}`)
			.font('light')
			.text(`Total billable time: `, { continued: true })
			.font('bold')
			.text(`${toDuration(report.total_billable)}`)
			.moveDown(0.5)
			.font('light')
			.text(`Total Time Billed: `, { continued: true })
			.font('bold')
			.text(`$${totalBilled.toFixed(2)}`)
			.moveDown(0.5)
			.fillColor(LINK_COLOR)
			.font('bold')
			.text('Full Report', {
				link: config[client.id].report,
				underline: true,
			})
			.font('light')
			.moveDown(1.5)

		doc.fontSize(10)
		for (const project of report.data) {
			const projectColor = Color(project.title.hex_color).darken(0.25).hex()

			doc
				.font('regular')
				.fillColor(projectColor)
				.text(project.title.project, {
					continued: true,
				})
				.fillColor(TEXT_COLOR)
				.font('bold')
				.text(
					` - ${toDuration(project.time)} - $${
						project.total_currencies[0].amount
					}`,
					{ continued: true }
				)
				.font('semibold')
				.text(` - $${project.items[0].rate}/hour`, { oblique: true })
				.moveDown(0.25)
			for (const item of project.items) {
				doc
					.font('light')
					.fillColor(projectColor)
					.text(item.title.time_entry, { continued: true })
					.fillColor(TEXT_COLOR)
					.text(`\t-\t${toDuration(item.time)}`, { continued: true })
					.font('bold')
					.text(`\t-\t$${item.sum.toFixed(2)}`)
					.font('light')
			}
			doc.moveDown(1)
		}

		const now = moment().format(dateFormat)

		doc
			.fillColor('gray')
			.text(
				`Generateed on ${now}`,
				null,
				doc.page.height - doc.page.margins.bottom * 2
			)

		doc.end()
	}
}

generate('year')
