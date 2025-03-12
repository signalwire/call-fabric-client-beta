const {
  SignalWire: SWire,
  enumerateDevices,
  checkPermissions,
  getCameraDevicesWithPermissions,
  getMicrophoneDevicesWithPermissions,
  getSpeakerDevicesWithPermissions,
  getMicrophoneDevices,
  getCameraDevices,
  getSpeakerDevices,
  supportsMediaOutput,
  createDeviceWatcher,
  createMicrophoneAnalyzer,
} = SignalWire

const searchInput = document.getElementById('searchInput')
const searchType = document.getElementById('searchType')
const conversationMessageInput = document.getElementById('new-conversation-message')
const sendMessageBtn = document.getElementById('send-message')

window.getMicrophoneDevices = getMicrophoneDevices
window.getCameraDevices = getCameraDevices
window.getSpeakerDevices = getSpeakerDevices
window.checkPermissions = checkPermissions
window.getCameraDevicesWithPermissions = getCameraDevicesWithPermissions
window.getMicrophoneDevicesWithPermissions = getMicrophoneDevicesWithPermissions
window.getSpeakerDevicesWithPermissions = getSpeakerDevicesWithPermissions

let roomObj = null
let client = null
let micAnalyzer = null
let pnSecretKey = null

const inCallElements = [
  roomControls,
  muteSelfBtn,
  unmuteSelfBtn,
  muteVideoSelfBtn,
  unmuteVideoSelfBtn,
  lockCallBtn,
  unlockCallBtn,
  deafSelfBtn,
  undeafSelfBtn,
  controlSliders,
  controlLayout,
  hideVMutedBtn,
  showVMutedBtn,
  hideScreenShareBtn,
  showScreenShareBtn,
  controlRecording,
  startRecordingBtn,
  stopRecordingBtn,
  pauseRecordingBtn,
  resumeRecordingBtn,
  controlPlayback,
]

const playbackElements = [
  stopPlaybackBtn,
  pausePlaybackBtn,
  resumePlaybackBtn,
  playbackVolumeControl,
  playbackSeekAbsoluteGroup,
]

window.playbackStarted = () => {
  playBtn.classList.add('d-none')
  playBtn.disabled = true

  playbackElements.forEach((button) => {
    button.classList.remove('d-none')
    button.disabled = false
  })
}
window.playbackEnded = () => {
  playBtn.classList.remove('d-none')
  playBtn.disabled = false

  playbackElements.forEach((button) => {
    button.classList.add('d-none')
    button.disabled = true
  })
}

const parser = new UAParser(window.navigator.userAgent)
const {
  ua: userAgent,
  browser: { name: browserName, version: browserVersion },
  os: { name: osName, version: osVersion },
  device: { type: deviceType },
}= parser.getResult()

window._userVariables = {
  fullBrowserVersion: browserVersion || '',
  gmtOffset: (-1.0 * new Date().getTimezoneOffset()) / 60,
  hostname: window.location.hostname,
  isAndroid: osName === 'Android',
  isChrome: browserName === 'Chrome',
  isChromium: browserName === 'Chromium',
  isEdge: browserName === 'Edge',
  isFirefox: browserName === 'Firefox',
  isIE: browserName === 'IE',
  isIOS: osName === 'iOS',
  isMobile: deviceType === 'mobile',
  isOpera: browserName === 'Opera',
  isSafari: browserName === 'Safari',
  isTablet: deviceType === 'tablet',
  isWinPhone: osName === 'Windows Mobile',
  isYandex: browserName === 'Yandex',
  osName: osName || '',
  osVersion: osVersion || '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tzString: new Date().toTimeString().split(' ').splice(1).join(' '),
  userAgent: userAgent,
}

async function enablePushNotifications() {
  btnRegister.disabled = true

  // Initialize Firebase App
  console.log('Firebase config', _firebaseConfig)

  const { vapidKey, ...config } = _firebaseConfig
  const app = FB.initializeApp(config)
  const messaging = FB.getMessaging(app)

  FB.onMessage(messaging, (payload) => {
    console.log('Push payload.data.message', payload.data.message)
    const message = JSON.parse(payload.data.message)
    handlePushNotification(message.notification.body)
    alert(body.title)
  })

  try {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log(`The service worker sent me a message: ${event.data}`)
      const message = JSON.parse(event.data || '{}')
      handlePushNotification(message.notification.body)
      alert(body.title)
    })

    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      {
        updateViaCache: 'none',
      }
    )

    console.log(
      'Service Worker registration successful with registration: ',
      registration
    )
    const serviceWorker =
      registration.active ?? registration.waiting ?? registration.installing
    if (serviceWorker.state !== 'activated') {
      await new Promise((resolve) => {
        serviceWorker.addEventListener('statechange', ({ target }) => {
          if (target.state === 'activated') {
            resolve()
          }
        })
      })
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await FB.getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey,
      })

      console.log('Device token:', token)

      /**
       * Register this device as a valid target for PN from SignalWire
       */
      const { push_notification_key } = await client.registerDevice({
        deviceType: 'Android', // Use Android w/ Firebase on the web
        deviceToken: token,
      })
      client.online({
        incomingCallHandlers: { pushNotification: __incomingCallNotification },
      })
      pnSecretKey = push_notification_key
      console.log('pnSecretKey: ', pnSecretKey)
      btnRegister.classList.add('d-none')
    }
  } catch (error) {
    btnRegister.disabled = false
    console.error('Service Worker registration failed: ', error)
  }
}

/**
 * Read the PN payload and accept the inbound call
 */
async function handlePushNotification(pushNotificationPayload) {
  try {
    const result = await readPushNotification(pushNotificationPayload)
    console.log('Push Notification:', result)
    const { resultType, resultObject } = await client.handlePushNotification(
      result
    )

    switch (resultType) {
      case 'inboundCall':
        this.logger.info('Inbound Call Push Notification received')
        break
      default:
        this.logger.warn('Unknown resultType', resultType, resultObject)
        return
    }
  } catch (error) {
    console.error('acceptCall', error)
  }
}

function b642ab(base64_string) {
  return Uint8Array.from(window.atob(base64_string), (c) => c.charCodeAt(0))
}

async function readPushNotification(payload) {
  console.log('payload', payload)

  const key = b642ab(pnSecretKey)
  const iv = b642ab(payload.iv)

  // Chain invite and tag to have the full enc string
  const full = atob(payload.invite) + atob(payload.tag)
  const fullEncrypted = Uint8Array.from(full, (c) => c.charCodeAt(0))

  async function decrypt(keyData, iv, data) {
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  }

  const compressed = await decrypt(key, iv, fullEncrypted)

  const result = window.pako.inflate(compressed, { to: 'string' }).toString()
  console.log('Dec:\n', JSON.stringify(JSON.parse(result), null, 2))

  return {
    ...payload,
    decrypted: JSON.parse(result),
  }
}

async function loadLayouts(currentLayoutId) {
  try {
    const { layouts } = await roomObj.getLayoutList()
    const fillSelectElement = (id) => {
      const layoutEl = document.getElementById(id)
      layoutEl.innerHTML = ''

      const defOption = document.createElement('option')
      defOption.value = ''
      defOption.innerHTML =
        id === 'layout' ? 'Change layout..' : 'Select layout for ScreenShare..'
      layoutEl.appendChild(defOption)
      for (var i = 0; i < layouts.length; i++) {
        const layout = layouts[i]
        var opt = document.createElement('option')
        opt.value = layout
        opt.innerHTML = layout
        layoutEl.appendChild(opt)
      }
      if (currentLayoutId) {
        layoutEl.value = currentLayoutId
      }
    }

    fillSelectElement('layout')
    fillSelectElement('ssLayout')
  } catch (error) {
    console.warn('Error listing layout', error)
  }
}

function setDeviceOptions({ deviceInfos, el, kind }) {
  if (!deviceInfos || deviceInfos.length === 0) {
    return
  }

  // Store the previously selected value so we could restore it after
  // re-populating the list
  const selectedValue = el.value

  // Empty the Select
  el.innerHTML = ''

  deviceInfos.forEach((deviceInfo) => {
    const option = document.createElement('option')

    option.value = deviceInfo.deviceId
    option.text = deviceInfo.label || `${kind} ${el.length + 1}`

    el.appendChild(option)
  })

  el.value = selectedValue || deviceInfos[0].deviceId
}

async function setAudioInDevicesOptions() {
  const micOptions = await getMicrophoneDevices()

  setDeviceOptions({
    deviceInfos: micOptions,
    el: microphoneSelect,
    kind: 'microphone',
  })
}

async function setAudioOutDevicesOptions() {
  if (supportsMediaOutput()) {
    const options = await getSpeakerDevices()

    setDeviceOptions({
      deviceInfos: options,
      el: speakerSelect,
      kind: 'speaker',
    })
  }
}

async function setVideoDevicesOptions() {
  const options = await getCameraDevices()

  setDeviceOptions({
    deviceInfos: options,
    el: cameraSelect,
    kind: 'camera',
  })
}

function initDeviceOptions() {
  setAudioInDevicesOptions()
  setAudioOutDevicesOptions()
  setVideoDevicesOptions()
}

function meter(el, val) {
  const canvasWidth = el.width
  const canvasHeight = el.height
  const ctx = el.getContext('2d')
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Border
  ctx.beginPath()
  ctx.rect(0, 0, canvasWidth, canvasHeight)
  ctx.strokeStyle = '#0f5e39'
  ctx.stroke()

  // Meter fill
  ctx.beginPath()
  ctx.rect(0, canvasHeight, canvasWidth, -val)
  ctx.stroke()
  ctx.fillStyle = '#198754'
  ctx.fill()
  ctx.stroke()
}

const initializeMicAnalyzer = async (stream) => {
  if (!stream) {
    return
  }

  const el = document.getElementById('mic-meter')
  micAnalyzer = await createMicrophoneAnalyzer(stream)
  micAnalyzer.on('volumeChanged', (vol) => {
    meter(el, vol)
  })
  micAnalyzer.on('destroyed', (reason) => {
    console.log('Microphone analyzer destroyed', reason)
  })
}

function restoreUI() {
  btnDial.classList.remove('d-none')
  btnDisconnect.classList.add('d-none')
  btnDisconnectMedia.classList.add('d-none')
  btnDisconnectWS.classList.add('d-none')
  btnAnswer.classList.add('d-none')
  btnReject.classList.add('d-none')
  tabs.classList.remove('d-none')
  callConsole.classList.remove('ringing')
  connectStatus.innerHTML = 'Not Connected'

  inCallElements.forEach((button) => {
    button.classList.add('d-none')
    button.disabled = true
  })
  window.__membersData = {}
  updateMembersUI()
}

async function initSWClient() {
  if (!_token) {
    console.error('Token not found')
    return
  }

  client = await SWire({
    host: !!_host && _host.trim().length ? _host : undefined,
    token: _token,
    debug: {
      logWsTraffic: true,
    },
    logLevel: 'debug',
  })

  return client
}

sendMessageBtn.addEventListener('click', async () => {
  if (!client) return
  const address = window.__currentAddress
  const text = conversationMessageInput.value
  await client.conversation.sendMessage({
    addressId: address.id,
    text,
  })
  conversationMessageInput.value = ''
})

/**
 * Connect with Relay creating a client and attaching all the event handler.
 */
window.dial = async () => {
  if (!client) {
    console.error('Client is not initialized!')
    return
  }

  btnDial.classList.add('d-none')
  btnDisconnect.classList.remove('d-none')
  window.__membersData = {}

  connectStatus.innerHTML = 'Connecting...'

  // Set a node_id for steering
  const steeringId = () => {
    const formValue = document.getElementById('steeringId').value

    return !!formValue && formValue.trim().length ? formValue.trim() : undefined
  }

  try {
    window._beforeDial = performance.now();
    const call = await client.dial({
      to: document.getElementById('destination').value,
      logLevel: 'debug',
      debug: { logWsTraffic: true },
      nodeId: steeringId(),
      rootElement: document.getElementById('rootElement'),
      userVariables: window._userVariables
    })

    window.__call = call
    roomObj = call

    roomObj.on('media.connected', () => {
      window._afterMediaConnected = performance.now();
      console.debug('>> media.connected')
      console.debug(`⏱️⏱️⏱️ From dial() to media.connect: ${window._afterMediaConnected - window._beforeDial}ms ⏱️⏱️⏱️`)
    })

    roomObj.on('media.reconnecting', () => {
      console.debug('>> media.reconnecting')
    })
    roomObj.on('media.disconnected', () => {
      console.debug('>> media.disconnected')
    })
    
    roomObj.on('room.started', (params) => {
      console.debug('>> room.started', params)
      window._afterRoomStared = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to room.started: ${window._afterRoomStared - window._beforeDial}ms ⏱️⏱️⏱️`)
    })

    roomObj.on('room.joined', (params) => {
      console.debug('>> room.joined', params)
      window._afterRoomJoined = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to room.joined: ${window._afterRoomJoined - window._beforeDial}ms ⏱️⏱️⏱️`)
      updateUIConnected()
    })

    roomObj.on('icegathering.new', (params) => {
      console.debug('>> icegathering.new', params)
      window._icegatheringNew = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to icegathering.new: ${window._icegatheringNew - window._beforeDial}ms ⏱️⏱️⏱️`)
    })

    roomObj.on('icegathering.new', (params) => {
      console.debug('>> icegathering.new', params)
      window._icegatheringNew = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to icegathering.new: ${window._icegatheringNew - window._beforeDial}ms ⏱️⏱️⏱️`)
    })

    roomObj.on('icegathering.gathering', (params) => {
      console.debug('>> icegathering.gathering', params)
      window._icegatheringGathering = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to icegathering.gathering: ${window._icegatheringGathering - window._beforeDial}ms ⏱️⏱️⏱️`)
    })

    roomObj.on('icegathering.complete', (params) => {
      console.debug('>> icegathering.complete', params)
      window._icegatheringComplete = performance.now()
      console.debug(`⏱️⏱️⏱️ From dial() to icegathering.complete: ${window._icegatheringComplete - window._beforeDial}ms ⏱️⏱️⏱️`)
    })
    
    roomObj.on('destroy', () => {
      console.debug('>> destroy')
      restoreUI()
    })
    roomObj.on('room.updated', (params) =>
      console.debug('>> room.updated', params)
    )

    roomObj.on('recording.started', (params) => {
      console.debug('>> recording.started', params)
      document.getElementById('recordingState').innerText = 'recording'
    })
    roomObj.on('recording.ended', (params) => {
      console.debug('>> recording.ended', params)
      document.getElementById('recordingState').innerText = 'completed'
    })
    roomObj.on('recording.updated', (params) => {
      console.debug('>> recording.updated', params)
      document.getElementById('recordingState').innerText = params.state
    })
    roomObj.on('room.ended', (params) => {
      console.debug('>> room.ended', params)
      hangup()
    })
    roomObj.on('member.joined', (params) => {
      const { member } = params
      console.debug('>> member.joined', member)
      window.__membersData = window.__membersData || {}
      window.__membersData[member.member_id] = member
      updateMembersUI()
    })
    roomObj.on('member.updated', (params) => {
      const { member } = params
      console.debug('>> member.updated', member)
      window.__membersData = window.__membersData || {}
      window.__membersData[member.member_id] = member
      updateMembersUI()
    })
    roomObj.on('member.talking', (params) =>
      console.debug('>> member.talking', params)
    )

    roomObj.on('member.updated.audio_muted', (params) =>
      console.debug('>> member.updated.audio_muted', params)
    )
    roomObj.on('member.updated.video_muted', (params) =>
      console.debug('>> member.updated.video_muted', params)
    )

    roomObj.on('member.left', (params) => {
      const { member } = params
      console.debug('>> member.left', member)
      if (window.__membersData[member.member_id]) {
        delete window.__membersData[member.member_id]
      }
    })
    roomObj.on('member.talking', (params) =>
      console.debug('>> member.talking', params)
    )
    roomObj.on('layout.changed', (params) =>
      console.debug('>> layout.changed', params)
    )
    roomObj.on('track', (event) => console.debug('>> DEMO track', event))

    roomObj.on('playback.started', (params) => {
      console.debug('>> playback.started', params)

      playbackStarted()
    })
    roomObj.on('playback.ended', (params) => {
      console.debug('>> playback.ended', params)

      playbackEnded()
    })
    roomObj.on('playback.updated', (params) => {
      console.debug('>> playback.updated', params)

      if (params.volume) {
        document.getElementById('playbackVolume').value = params.volume
      }
    })
    await call.start()

    console.debug('Call Obj', call)

    const joinHandler = (params) => {
      console.debug('>> room.joined', params)

      updateUIConnected()

      // loadLayouts()
    }
    joinHandler()
  } catch (e) {
    alert(
      `Something went wrong trying to dial ${
        document.getElementById('destination').value
      }`
    )
  }
}

function updateUIRinging() {
  btnDial.classList.add('d-none')
  btnAnswer.classList.remove('d-none')
  btnReject.classList.remove('d-none')
  callConsole.classList.add('ringing')
  connectStatus.innerHTML = 'Ringing'

  inCallElements.forEach((button) => {
    button.classList.remove('d-none')
    button.disabled = false
  })
}

function updateUIConnected() {
  btnDial.classList.add('d-none')
  btnAnswer.classList.add('d-none')
  btnReject.classList.add('d-none')
  tabs.classList.add('d-none')
  btnDisconnect.classList.remove('d-none')
  btnDisconnectMedia.classList.remove('d-none')
  btnDisconnectWS.classList.remove('d-none')
  callConsole.classList.remove('ringing')
  connectStatus.innerHTML = 'Connected'

  inCallElements.forEach((button) => {
    button.classList.remove('d-none')
    button.disabled = false
  })
}

window.__avaliable = false

window.executeRPC = async () => {
  resultRPC.innerText = '';
  const params = JSON.parse(rpcBody.value);
  const result = await window.__client.__wsClient.wsClient.execute(params);
  resultRPC.innerText = JSON.stringify(result, null, 2);
}

window.toggleAvaliable = async () => {
  if(!client) {
    console.error('Client not connected')
    return
  }

  window.__avaliable = !window.__avaliable
  const isOn = window.__avaliable
  btnAvaliable.innerText = isOn ? 'get offline' : 'get online'
  btnAvaliable.classList = isOn ? 'btn btn-success' : 'btn btn-warning'

  if (isOn) {
    await client.online({
      incomingCallHandlers: { all: __incomingCallNotification },
    })
  } else {
    await client.offline()
  }
}

window.__incomingCallNotification = (notification) => {
  if (
    !window.__invite ||
    window.__invite.details.callID !== notification.invite.details.callID
  ) {
    window.__invite = notification.invite
  }
  updateUIRinging()
}

window.answer = async () => {
  const call = await window.__invite.accept({
    rootElement: document.getElementById('rootElement'),
  })
  window.__call = call
  roomObj = call
  window.__call.on('destroy', () => {
    console.warn('Inbound Call got cancelled!!')
  })
  updateUIConnected()
}

/**
 * Dev Only
 */

window.simulate_no_packets = () => {
  window.__call._closeWSConnection();
}

window.simulate_socket_error = () => {
  window.__client.__wsClient.wsClient.store.dispatch({type: "session.forceClose"})
}

window.reject = async () => {
  await window.__invite.reject()
  restoreUI()
}
/**
 * Hangup the roomObj if present
 */
window.hangup = () => {
  if (micAnalyzer) {
    micAnalyzer.destroy()
  }

  if (roomObj && roomObj.state !== 'destroy') {
    roomObj.hangup()
  }

  restoreUI()
}

window.saveInLocalStorage = (e) => {
  const key = e.target.name || e.target.id
  localStorage.setItem('fabric.ws.' + key, e.target.value)
}

// jQuery document.ready equivalent
window.ready = (callback) => {
  if (document.readyState != 'loading') {
    callback()
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', callback)
  } else {
    document.attachEvent('onreadystatechange', function () {
      if (document.readyState != 'loading') {
        callback()
      }
    })
  }
  const localSteeringId = document.getElementById('steeringId')
  localSteeringId.value = localStorage.getItem('fabric.ws.steeringId') || ''

  // Destination is populated through ENV by default
  const localDestination = localStorage.getItem('fabric.ws.destination')
  if (localDestination) {
    document.getElementById('destination').value = localDestination
  }
}

let screenShareObj
window.startScreenShare = async () => {
  let opts = {}
  const ssPos = document.getElementById('ssPosition')?.value || ''
  if (ssPos.trim()) {
    opts = {
      positions: {
        self: ssPos.trim(),
      },
    }
  }
  const layout = document.getElementById('ssLayout').value.trim()
  if (layout) {
    opts.layout = layout
  }
  screenShareObj = await roomObj
    .startScreenShare({
      audio: true,
      video: true,
      ...opts,
    })
    .catch((error) => {
      console.error('ScreenShare Error', error)
    })

  screenShareObj.once('destroy', () => {
    console.debug('screenShare destroy')
  })

  screenShareObj.once('room.left', () => {
    console.debug('screenShare room.left')
  })
}
window.stopScreenShare = () => {
  screenShareObj.hangup()
}

window.muteAll = () => {
  roomObj.audioMute({ memberId: 'all' })
}

window.unmuteAll = () => {
  roomObj.audioUnmute({ memberId: 'all' })
}

window.muteSelf = () => {
  roomObj.audioMute()
}

window.unmuteSelf = () => {
  roomObj.audioUnmute()
}

window.muteMember = (id) => {
  roomObj.audioMute({ memberId: id })
}

window.unmuteMember = (id) => {
  roomObj.audioUnmute({ memberId: id })
}

window.muteVideoAll = () => {
  roomObj.videoMute({ memberId: 'all' })
}

window.unmuteVideoAll = () => {
  roomObj.videoUnmute({ memberId: 'all' })
}

window.muteVideoMember = (id) => {
  roomObj.videoMute({ memberId: id })
}

window.unmuteVideoMember = () => {
  roomObj.videoUnmute({ memberId: id })
}

window.removeMember = (id) => {
  roomObj.removeMember({ memberid: id})
}

window.muteVideoSelf = () => {
  roomObj.videoMute()
}

window.unmuteVideoSelf = () => {
  roomObj.videoUnmute()
}

window.lockCall = () => {
  roomObj.lock()
}

window.unlockCall = () => {
  roomObj.unlock()
}

window.deafSelf = () => {
  roomObj.deaf()
}

window.undeafSelf = () => {
  roomObj.undeaf()
}

window.hideVideoMuted = () => {
  roomObj.hideVideoMuted()
}

window.showVideoMuted = () => {
  roomObj.showVideoMuted()
}

window.changeLayout = (select) => {
  console.log('changeLayout', select.value)
  roomObj.setLayout({ name: select.value })
}

window.changeMicrophone = (select) => {
  console.log('changeMicrophone', select.value)
  if (!select.value) {
    return
  }
  roomObj.updateMicrophone({ deviceId: select.value }).then(() => {
    initializeMicAnalyzer(roomObj.localStream)
  })
}

window.changeCamera = (select) => {
  console.log('changeCamera', select.value)
  if (!select.value) {
    return
  }
  roomObj.updateCamera({ deviceId: select.value })
}

window.changeSpeaker = (select) => {
  console.log('changeSpeaker', select.value)
  if (!select.value) {
    return
  }
  roomObj
    .updateSpeaker({ deviceId: select.value })
    .then(() => {
      console.log('Speaker updated!')
    })
    .catch(() => {
      console.error(`Failed to update the speaker with id: ${select.value}`)
    })
}

window.rangeInputHandler = (range) => {
  switch (range.id) {
    case 'microphoneVolume':
      roomObj.setMicrophoneVolume({ volume: range.value })
      break
    case 'speakerVolume':
      roomObj.setSpeakerVolume({ volume: range.value })
      break
    case 'inputSensitivity':
      roomObj.setInputSensitivity({ value: range.value })
      break
    case 'playbackVolume': {
      if (!playbackObj) {
        return console.warn('Invalid playbackObj for `setVolume`')
      }
      playbackObj
        .setVolume(range.value)
        .then((response) => {
          console.log('Playback setVolume:', response)
        })
        .catch((error) => {
          console.error('Failed to set the playback volume:', error)
        })
      break
    }
  }
}

let recordingObj = null
window.startRecording = () => {
  console.debug('>> startRecording')
  roomObj
    .startRecording()
    .then((response) => {
      console.log('Recording started!', response)
      recordingObj = response
    })
    .catch((error) => {
      console.error('Failed to start recording:', error)
    })
}

window.stopRecording = () => {
  console.debug('>> stopRecording')
  recordingObj
    .stop()
    .then((response) => {
      console.log('Recording stopped!', response)
      recordingObj = null
    })
    .catch((error) => {
      console.error('Failed to stop recording:', error)
    })
}

window.pauseRecording = () => {
  console.debug('>> pauseRecording')
  recordingObj
    .pause()
    .then((response) => {
      console.log('Recording paused!', response)
    })
    .catch((error) => {
      console.error('Failed to pause recording:', error)
    })
}

window.resumeRecording = () => {
  console.debug('>> resumeRecording')
  recordingObj
    .resume()
    .then((response) => {
      console.log('Recording resumed!', response)
    })
    .catch((error) => {
      console.error('Failed to resume recording:', error)
    })
}

let playbackObj = null
window.startPlayback = () => {
  const url = document.getElementById('playbackUrl').value
  if (!url) {
    return console.warn('Invalid playback URL')
  }
  console.debug('>> startPlayback', url)
  roomObj
    .play({ url, volume: 10 })
    .then((response) => {
      console.log('Playback started!', response)
      playbackObj = response
    })
    .catch((error) => {
      console.error('Failed to start playback:', error)
    })
}

window.stopPlayback = () => {
  console.debug('>> stopPlayback')
  playbackObj
    .stop()
    .then((response) => {
      console.log('Playback stopped!', response)
      playbackObj = null
    })
    .catch((error) => {
      console.error('Failed to stop playback:', error)
    })
}

window.pausePlayback = () => {
  console.debug('>> pausePlayback')
  playbackObj
    .pause()
    .then((response) => {
      console.log('Playback paused!', response)
    })
    .catch((error) => {
      console.error('Failed to pause playback:', error)
    })
}

window.resumePlayback = () => {
  console.debug('>> resumePlayback')
  playbackObj
    .resume()
    .then((response) => {
      console.log('Playback resumed!', response)
    })
    .catch((error) => {
      console.error('Failed to resume playback:', error)
    })
}

window.seekPlayback = () => {
  const value = document.getElementById('playbackSeekAbsolute').value
  if (!value) {
    return console.warn('Invalid Seek Value')
  } else if (!playbackObj) {
    return console.warn("playbackObj doesn't exist")
  }
  console.debug('>> seekPlaybackBtn', value)
  playbackObj
    .seek(value)
    .then(() => {
      console.log('Playback.seek was successful')
    })
    .catch((error) => {
      console.error('Failed to seek playback:', error)
    })
}

window.seekRewindPlayback = () => {
  if (!playbackObj) {
    return console.warn("playbackObj doesn't exist")
  }
  console.debug('>> seekRewindPlayback')
  playbackObj
    .rewind(1000)
    .then(() => {
      console.log('Playback.rewind was successful')
    })
    .catch((error) => {
      console.error('Failed to rewind playback:', error)
    })
}

window.seekForwardPlayback = () => {
  if (!playbackObj) {
    return console.warn("playbackObj doesn't exist")
  }
  console.debug('>> seekForwardPlayback')
  playbackObj
    .forward(1000)
    .then(() => {
      console.log('Playback.forward was successful')
    })
    .catch((error) => {
      console.error('Failed to forward playback:', error)
    })
}

window.ready(async function () {
  console.log('Ready!')
  await initSWClient()
  const searchParams = new URLSearchParams(location.search)
  console.log('Handle inbound?', searchParams.has('inbound'))
  if (searchParams.has('inbound')) {
    await enablePushNotifications()
  }
  Promise.all([fetchHistories(), fetchAddresses()])
})

const escapeHTML = (str) => {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function isBlank(str) {
  return str === null || str === undefined || str === '' || str === 'null'
}

/** ======= Tab utilities start ======= */
window.toggleTabState = async (activeButtonName) => {
  const config = [
    {
      name: 'directory',
      button: document.querySelector('button[name="Directory"]'),
      card: document.getElementById('addressCard'),
    },
    {
      name: 'history',
      button: document.querySelector('button[name="History"]'),
      card: document.getElementById('historyCard'),
    },
  ]

  config.forEach(({ name, button, card }) => {
    if (name === activeButtonName) {
      button.classList.add('active', 'text-black')
      button.classList.remove('text-secondary')
      card.classList.remove('d-none')
    } else {
      button.classList.remove('active', 'text-black')
      button.classList.add('text-secondary')
      card.classList.add('d-none')
    }
  })

  if (activeButtonName === 'history') {
    await fetchHistories()
  }

  if (activeButtonName === 'directory') {
    await fetchAddresses()
  }
}

function updatePaginationUI(activeButtonName) {
  const config = [
    {
      name: 'address',
      paginationDiv: document.getElementById('addressPagination'),
      data: window.__addressData,
      fetchNext: fetchNextAddresses,
      fetcthPrev: fetchPrevAddresses,
    },
    {
      name: 'history',
      paginationDiv: document.getElementById('historyPagination'),
      data: window.__historyData,
      fetchNext: fetchNextHistories,
      fetcthPrev: fetchPrevHistories,
    },
    {
      name: 'message',
      paginationDiv: document.getElementById('messagePagination'),
      data: window.__messageData,
      fetchNext: fetchNextMessages,
      fetcthPrev: fetchPrevMessages,
    },
  ]

  const currentConf = config.find((conf) => conf.name === activeButtonName)
  if (!currentConf?.data) return

  currentConf.paginationDiv.classList.remove('d-none')
  const nextBtn = currentConf.paginationDiv.querySelector(
    'button[name="fetch-next"]'
  )
  const prevBtn = currentConf.paginationDiv.querySelector(
    'button[name="fetch-prev"]'
  )

  if (nextBtn) {
    nextBtn.onclick = currentConf.fetchNext
    nextBtn.disabled = !currentConf.data.hasNext
  }

  if (prevBtn) {
    prevBtn.onclick = currentConf.fetcthPrev
    prevBtn.disabled = !currentConf.data.hasPrev
  }
}

/** ======= Tab utilities end ======= */

/** ======= Address utilities start ======= */
const createAddressListItem = (address) => {
  const displayName = escapeHTML(address.display_name)
  const type = escapeHTML(address.type)

  const listItem = document.createElement('li')
  listItem.className = 'list-group-item'
  listItem.id = address.id

  const container = document.createElement('div')
  container.className = 'container p-0'
  listItem.appendChild(container)

  const row = document.createElement('div')
  row.className = 'row'
  container.appendChild(row)

  const col1 = document.createElement('div')
  col1.className = 'col-10'
  row.appendChild(col1)

  const badge = document.createElement('span')
  badge.className = 'badge bg-primary me-2'
  badge.textContent = type
  col1.appendChild(badge)

  const addressNameLink = document.createElement('button')
  addressNameLink.textContent = displayName
  addressNameLink.className = 'btn btn-link p-0'
  addressNameLink.onclick = () => openMessageModal(address)
  col1.appendChild(addressNameLink)

  const col2 = document.createElement('div')
  col2.className = 'col'
  row.appendChild(col2)

  Object.entries(address.channels).forEach(([channelName, channelValue]) => {
    const button = document.createElement('button')
    button.className = 'btn btn-sm btn-success'
    const icon = document.createElement('i')
    if (channelName === 'messaging') {
      icon.className = 'bi bi-chat'
      button.addEventListener('click', () => openMessageModal(address))
    } else if (channelName === 'video') {
      icon.className = 'bi bi-camera-video'
      button.addEventListener('click', () => dialAddress(channelValue))
    } else if (channelName === 'audio') {
      icon.className = 'bi bi-phone'
      button.addEventListener('click', () => dialAddress(channelValue))
    }
    button.appendChild(icon)

    col2.appendChild(button)
  })

  const row2 = document.createElement('div')
  const addressUrl = Object.values(address.channels)[0]
  let strippedUrl = addressUrl.split('?')[0]
  row2.textContent = strippedUrl
  container.appendChild(row2)

  return listItem
}

function updateMembersUI() {
  const membersDiv = document.getElementById('members')
  membersDiv.innerHTML = ''
  const members = window.__membersData

  const createMemberItem = (member) => {
    const createChildElement = (options) => {
      const el = document.createElement(options.tag)

      Object.entries(options).forEach(([key, value]) => {
        if (['tag', 'parent'].includes(key)) return
        el[key] = value
      })

      options.parent.appendChild(el)

      return el
    }

    const listItem = document.createElement('li')
    listItem.className = 'list-group-item'

    const memberDiv = document.createElement('div')
    memberDiv.className = 'row p-0'
    listItem.appendChild(memberDiv)

    createChildElement({
      tag: 'div',
      textContent: member.type,
      className: 'badge bg-primary me-2',
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: member.id,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: member.name,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `${member.currentPosition}=>${member.requestedPosition}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: member.meta
        ? Object.entries(member.meta).reduce((previous, [key, value]) => {
            return `${previous},${key}:${value}`
          }, '')
        : 'no meta',
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `visible:${member.visible}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `audio muted:${member.audio_muted}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `video muted:${member.video_muted}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `deaf:${member.deaf}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `talking: ${member.talking}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `handraised: ${member.handraised}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `input volume: ${member.input_volume}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `input sensitivity: ${member.input_sensitivity}`,
      parent: memberDiv,
    })

    createChildElement({
      tag: 'div',
      textContent: `input volume: ${member.output_volume}`,
      parent: memberDiv,
    })

    const actionsDiv = createChildElement({
      tag: 'div',
      className: 'btn-group-vertical btn-group-sm',
      parent: memberDiv,
    })

    createChildElement({
      tag: 'a',
      className: 'btn btn-warning',
      textContent: 'mute audio',
      href: '#',
      onclick: () => window.muteMember(member.id),
      parent: actionsDiv,
    })
    createChildElement({
      tag: 'a',
      className: 'btn btn-warning',
      textContent: 'unmute audio',
      href: '#',
      onclick: () => window.unmuteMember(member.id),
      parent: actionsDiv,
    })
    createChildElement({
      tag: 'a',
      className: 'btn btn-warning',
      textContent: 'mute video',
      href: '#',
      onclick: () => console.log('### Nothing Executed ###'),
      parent: actionsDiv,
    })
    createChildElement({
      tag: 'a',
      className: 'btn btn-warning',
      textContent: 'unmute video',
      href: '#',
      onclick: () => console.log('### Nothing Executed ###'),
      parent: actionsDiv,
    })
    createChildElement({
      tag: 'a',
      className: 'btn btn-warning',
      textContent: 'remove member',
      href: '#',
      onclick: () => window.removeMember(member.id),
      parent: actionsDiv,
    })

    memberDiv.appendChild(actionsDiv)

    return listItem
  }

  Object.values(members)
    .map(createMemberItem)
    .forEach((memberCard) => membersDiv.appendChild(memberCard))
}

function updateAddressUI() {
  const { data: addresses } = window.__addressData || {}
  if (!addresses) return

  const addressDiv = document.getElementById('addresses')
  const addressUl = addressDiv.querySelector('ul')
  addressUl.innerHTML = ''
  addresses
    .map(createAddressListItem)
    .forEach((item) => addressUl.appendChild(item))

  updatePaginationUI('address')
}

async function fetchAddresses() {
  if (!client) return
  try {
    const searchText = searchInput.value
    const selectedType = searchType.value

    const addressData = await client.address.getAddresses({
      type: selectedType === 'all' ? undefined : selectedType,
      displayName: !searchText.length ? undefined : searchText,
      pageSize: 10,
    })
    window.__addressData = addressData
  } catch (error) {
    console.error('Unable to fetch addresses', error)
  } finally {
    updateAddressUI()
  }
}

async function dialAddress(address) {
  const destinationInput = document.getElementById('destination')
  destinationInput.value = address
  dial()
}

async function fetchNextAddresses() {
  const { hasNext, nextPage } = window.__addressData
  try {
    if (!hasNext) return
    const nextAddresses = await nextPage()
    window.__addressData = nextAddresses
    updateAddressUI()
  } catch (error) {
    console.error('Unable to fetch next addresses', error)
  }
}

async function fetchPrevAddresses() {
  const { hasPrev, prevPage } = window.__addressData
  try {
    if (!hasPrev) return
    const prevAddresses = await prevPage()
    window.__addressData = prevAddresses
    updateAddressUI()
  } catch (error) {
    console.error('Unable to fetch prev addresses', error)
  }
}

let debounceTimeout
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimeout)
  // Search after 1 seconds when user stops typing
  debounceTimeout = setTimeout(fetchAddresses, 1000)
})

searchType.addEventListener('change', fetchAddresses)

/** ======= Address utilities end ======= */

/** ======= History utilities start ======= */
function formatMessageDate(date) {
  const dateOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }
  return new Date(date).toLocaleString('en-US', dateOptions)
}

function createConversationListItem(convo) {
  const item = document.createElement('li')
  item.classList.add('list-group-item')
  item.id = convo.id

  const convoDiv = document.createElement('div')
  convoDiv.className = 'd-flex align-items-center'

  const labelSpan = document.createElement('span')
  labelSpan.textContent = 'Conversation name: '
  labelSpan.className = 'me-1'

  const convoNameLink = document.createElement('button')
  convoNameLink.textContent = convo.name
  convoNameLink.className = 'btn btn-link p-0'
  convoNameLink.onclick = () => openMessageModal(convo)

  convoDiv.appendChild(labelSpan)
  convoDiv.appendChild(convoNameLink)
  item.appendChild(convoDiv)

  const lastMessageDiv = document.createElement('div')
  lastMessageDiv.textContent = `Last message at: ${formatMessageDate(
    convo.last_message_at
  )}`
  lastMessageDiv.classList.add('small', 'text-secondary')
  item.appendChild(lastMessageDiv)
  return item
}

function updateHistoryUI() {
  const { data: histories } = window.__historyData || {}
  if (!histories) return

  const historyDiv = document.getElementById('histories')
  const historyUl = historyDiv.querySelector('ul')
  historyUl.innerHTML = ''
  histories
    .map(createConversationListItem)
    .forEach((item) => historyUl.appendChild(item))

  updatePaginationUI('history')
}

async function fetchHistories() {
  if (!client) return
  try {
    const historyData = await client.conversation.getConversations({
      pageSize: 10,
    })
    window.__historyData = historyData
    subscribeToNewMessages()
  } catch (error) {
    console.error('Unable to fetch histories', error)
  } finally {
    updateHistoryUI()
  }
}

function createLiveMessageListItem(msg) {
  const listItem = document.createElement('li')
  listItem.classList.add('list-group-item')
  listItem.id = msg.id
  const formattedTimestamp = formatMessageDate(msg.ts * 1000)
  listItem.innerHTML = `
    <div class="d-flex flex-column">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="mb-0 text-capitalize">${msg.type ?? 'unknown'}</h6>
          <p class="mb-1 fst-italic">${msg.conversation_name}</p>
        <div>
        <div class="d-flex align-items-center gap-1">
          <span class="badge bg-info">${msg.subtype ?? 'unknown'}</span>
          <span class="badge bg-success">${msg.kind ?? 'unknown'}</span>
        </div>
      </div>
      <p class="text-muted small mb-0">${formattedTimestamp}</p>
    </div>
  `
  return listItem
}

let isConvoSubscribed = false
function subscribeToNewMessages() {
  if (!isConvoSubscribed) {
    client.conversation.subscribe((newMsg) => {
      console.log('New message received!', newMsg)

      // Refetch both histories and directories to update the last message time (no await)
      Promise.all([fetchHistories(), fetchAddresses()])

      // If message modal is opened, update modal message list
      const oldMessages = window.__messageData
      if (
        oldMessages &&
        newMsg.conversation_id === oldMessages?.data?.[0]?.conversation_id
      ) {
        const messageList = msgModalDiv.querySelector('#messageList')
        const newListItem = createMessageListItem(newMsg)
        if (messageList.firstChild) {
          messageList.insertBefore(newListItem, messageList.firstChild)
        } else {
          messageList.appendChild(newListItem)
        }
      }

      // Update in call live messages
      const liveMessageList = document.querySelector('#liveMessageList')
      const newListItem = createLiveMessageListItem(newMsg)
      if (liveMessageList.firstChild) {
        liveMessageList.insertBefore(newListItem, liveMessageList.firstChild)
      } else {
        liveMessageList.appendChild(newListItem)
      }
    })
    isConvoSubscribed = true
  }
}

async function fetchNextHistories() {
  const { hasNext, nextPage } = window.__historyData
  try {
    if (!hasNext) return
    const nextHistory = await nextPage()
    window.__historyData = nextHistory
    updateHistoryUI()
  } catch (error) {
    console.error('Unable to fetch next histories', error)
  }
}

async function fetchPrevHistories() {
  const { hasPrev, prevPage } = window.__historyData
  try {
    if (!hasPrev) return
    const prevHistory = await prevPage()
    window.__historyData = prevHistory
    updateHistoryUI()
  } catch (error) {
    console.error('Unable to fetch prev histories', error)
  }
}

/** ======= History utilities end ======= */

/** ======= Message utilities start ======= */
function createMessageListItem(msg) {
  const listItem = document.createElement('li')
  listItem.classList.add('list-group-item')
  listItem.id = msg.id
  const formattedTimestamp = formatMessageDate(msg.ts * 1000)
  listItem.innerHTML = `
    <div class="d-flex flex-column">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0 text-capitalize">${msg.text ?? 'unknown'}</h6>
        <div class="d-flex align-items-center gap-1">
          <span class="badge bg-info">${msg.type ?? 'unknown'}</span>
          <span class="badge bg-warning">${msg.subtype ?? 'unknown'}</span>
          <span class="badge bg-success">${msg.kind ?? 'unknown'}</span>
        </div>
      </div>
      <p class="text-muted small mb-0">${formattedTimestamp}</p>
    </div>
  `
  return listItem
}

const msgModalDiv = document.getElementById('messageModal')

msgModalDiv.addEventListener('hidden.bs.modal', clearMessageModal)

function clearMessageModal() {
  window.__currentAddress = null
  window.__messageData = null
  const titleH2 = msgModalDiv.querySelector('.title')
  const typeBadgeSpan = msgModalDiv.querySelector('.type-badge')
  const contactBtnDiv = msgModalDiv.querySelector('.contact-buttons')
  const messageList = msgModalDiv.querySelector('#messageList')
  const messagePagination = msgModalDiv.querySelector('#messagePagination')
  const loaderListItem = msgModalDiv.querySelector('#messageList li')
  const avatarImage = msgModalDiv.querySelector('.avatar')
  titleH2.textContent = ''
  typeBadgeSpan.textContent = ''
  contactBtnDiv.classList.add('d-none')
  messagePagination.classList.add('d-none')
  // Remove all the message list item except the first one (loader)
  Array.from(messageList.children)
    .slice(1)
    .forEach((item) => item.remove())
  loaderListItem.classList.remove('d-none')
  // Set the new image URL to the avatar image for the next time the modal opens
  const newImageUrl = `https://i.pravatar.cc/125?img=${
    Math.floor(Math.random() * 70) + 1
  }`
  if (avatarImage) {
    avatarImage.src = newImageUrl
  }
}

async function openMessageModal(data) {
  window.__currentAddress = data
  const modal = new bootstrap.Modal(msgModalDiv)
  modal.show()

  const titleH2 = msgModalDiv.querySelector('.title')
  titleH2.textContent = data.display_name || data.name || 'John Doe'

  if (data.type) {
    const typeBadgeSpan = msgModalDiv.querySelector('.type-badge')
    typeBadgeSpan.textContent = data.type
    typeBadgeSpan.classList.add('badge', 'bg-primary')
  }

  if (data.channels) {
    const contactBtnDiv = msgModalDiv.querySelector('.contact-buttons')
    contactBtnDiv.classList.remove('d-none')
    if (data.channels.audio) {
      const audioBtn = contactBtnDiv.querySelector('.btn-dial-audio')
      audioBtn.classList.remove('d-none')
      audioBtn.onclick = () => {
        dialAddress(data.channels.audio)
        modal.hide()
      }
    }
    if (data.channels.video) {
      const videoBtn = contactBtnDiv.querySelector('.btn-dial-video')
      videoBtn.classList.remove('d-none')
      videoBtn.onclick = () => {
        dialAddress(data.channels.video)
        modal.hide()
      }
    }
    if (data.channels.messaging) {
      const messagingBtn = contactBtnDiv.querySelector('.btn-dial-messaging')
      messagingBtn.classList.remove('d-none')
      messagingBtn.onclick = () => {
        dialAddress(data.channels.messaging)
        modal.hide()
      }
    }
  }

  // Fetch messages and populate the UI
  await fetchMessages(data.id)
}

function updateMessageUI() {
  const { data: messages } = window.__messageData
  const messageList = msgModalDiv.querySelector('#messageList')
  const loaderListItem = messageList.querySelector('li')
  loaderListItem.classList.add('d-none')
  messageList.innerHTML = ''
  if (!messages?.length) {
    const noMsglistItem = document.createElement('li')
    noMsglistItem.classList.add('list-group-item')
    noMsglistItem.innerHTML = `
      <div class="d-flex justify-content-center">
          <h6 class="my-2">No messages yet!</h6>
      </div>
    `
    messageList.appendChild(noMsglistItem)
    return
  }
  messages
    .map(createMessageListItem)
    .forEach((li) => messageList.appendChild(li))

  updatePaginationUI('message')
}

async function fetchMessages(id) {
  if (!client) return
  try {
    const messages = await client.conversation.getConversationMessages({
      addressId: id,
      pageSize: 10,
    })
    window.__messageData = messages
    subscribeToNewMessages()
  } catch (error) {
    console.error('Unable to fetch messages', error)
  } finally {
    updateMessageUI()
  }
}

async function fetchNextMessages() {
  const { hasNext, nextPage } = window.__messageData
  try {
    if (!hasNext) return
    const nextMessage = await nextPage()
    window.__messageData = nextMessage
    updateMessageUI()
  } catch (error) {
    console.error('Unable to fetch next message', error)
  }
}

async function fetchPrevMessages() {
  const { hasPrev, prevPage } = window.__messageData
  try {
    if (!hasPrev) return
    const prevMessage = await prevPage()
    window.__messageData = prevMessage
    updateMessageUI()
  } catch (error) {
    console.error('Unable to fetch prev message', error)
  }
}

/** ======= Message utilities end ======= */
