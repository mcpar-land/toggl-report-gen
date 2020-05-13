const fs = require('fs')
const path = require('path')
const deepmerge = require('deepmerge')

const configPath = path.join(__dirname + '/../config/clients.json')

if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, '{}')

const getConfig = () => {
	return JSON.parse(fs.readFileSync(configPath).toString())
}

const setConfig = (config) => {
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

const updateConfig = (config) => {
	const currentConfig = getConfig()
	const newConfig = deepmerge(currentConfig, config)

	setConfig(newConfig)
}

module.exports = {
	getConfig,
	setConfig,
	updateConfig,
}
