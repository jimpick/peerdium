const baseURI = new URL("https://lunet.jimpick.com/")

const localstorage_available = typeof Storage !== "undefined"
var quill

function update_heart(class_name) {
  var heart_div_parent = document.getElementById("heart-parent")
  while (heart_div_parent.hasChildNodes()) {
    heart_div_parent.removeChild(heart_div_parent.lastChild)
  }
  var heart_div = document.createElement("div")
  heart_div.className = class_name
  heart_div_parent.appendChild(heart_div)
}

function save_doc() {
  if (localstorage_available) {
    localStorage.setItem(get_info_hash_from_url(), encryped_content)
  }
}

function remove_doc() {
  if (localstorage_available) {
    localStorage.removeItem(get_info_hash_from_url())
  }
}

const parseHash = () => {
  const password = location.hash.slice(1, 25)
  const address = location.hash.slice(25)
  if (password.length === 24 && address.length > 24) {
    return [password, address]
  } else {
    return null
  }
}
const toHex = bytes =>
  Array.from(bytes)
    .map(byte => ("00" + byte.toString(16)).slice(-2))
    .join("")

const fromHex = hex => hex.match(/.{2}/g).map(byte => parseInt(byte, 16))

const generatePassword = (size = 12) =>
  toHex(crypto.getRandomValues(new Uint8Array(size)))

const encrypt = async (message, password) => {
  const rawKey = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const algorithm = { name: "AES-GCM", iv }
  const key = await crypto.subtle.importKey("raw", rawKey, algorithm, false, [
    "encrypt"
  ])

  const encryptedMessage = await crypto.subtle.encrypt(
    algorithm,
    key,
    new TextEncoder().encode(message)
  )

  const cipher = Array.from(new Uint8Array(encryptedMessage))
    .map(byte => String.fromCharCode(byte))
    .join("")

  return toHex(iv) + btoa(cipher)
}

const decrypt = async (data, password) => {
  const rawKey = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  )
  const iv = new Uint8Array(fromHex(data.slice(0, 24)))

  const algorithm = { name: "AES-GCM", iv }
  const key = await crypto.subtle.importKey("raw", rawKey, algorithm, false, [
    "decrypt"
  ])

  const encodedMessage = atob(data.slice(24))
  const encryptedMessage = encodedMessage
    .match(/[\s\S]/g)
    .map(ch => ch.charCodeAt(0))

  const message = await crypto.subtle.decrypt(
    algorithm,
    key,
    new Uint8Array(encryptedMessage)
  )
  return new TextDecoder().decode(message)
}

const publish = async file => {
  const data = new FormData()
  data.append("file", file)

  const put = await fetch(new URL(`/api/v0/add`, baseURI), {
    body: data,
    method: "POST"
  })
  const { Hash } = await put.json()

  return Hash
}

const cidBase32 = async cid => {
  const get = await fetch(new URL(`/api/v0/cid/base32?arg=${cid}`, baseURI))
  const { Formatted: newCid } = await get.json()

  return newCid
}

const load = async cid => {
  const response = await fetch(new URL(`/ipfs/${cid}`, baseURI))
  if (response.status === 200) {
    return await response.text()
  } else {
    throw new Error(
      `Unable to fetch document ${response.statusText} : ${response.status}`
    )
  }
}

const addToLibrary = async (hash, title) => {
  const params = new URLSearchParams([
    ["arg", `/ipfs/${hash}`],
    ["arg", `/${title}`]
  ])

  return await fetch(
    new URL(`/api/v0/files/cp?${params.toString()}`, baseURI),
    {
      method: "POST"
    }
  )
}

var post_info = new Vue({
  el: "#post-info-section",
  data: {
    show_post_button: true,
    class_name: "",
    published_url: null
  },
  methods: {
    post_document: async () => {
      const password = generatePassword()
      const text = quill.getText()
      const title = text.slice(0, text.indexOf("\n"))
      const document = JSON.stringify(quill.getContents())
      const content = await encrypt(document, password)
      const file = new File([content], title, { type: "text/plain" })
      const hash = await publish(file)
      const staticFile = new File(
        [quill.getText()],
        'index.txt',
        { type: "text/plain" }
      )
      const staticCid = await publish(staticFile)
      const staticCidBase32 = await cidBase32(staticCid)
      console.log('Jim published staticly', staticCidBase32)
      post_info.published_url = `https://${staticCidBase32}.lunet.v6z.me/`

      location.hash = `${password}${hash}`

      if (title.length > 0) {
        await addToLibrary(hash, title)
      }
    },
    toogle_heart: function() {
      if (post_info.class_name === "fas fa-heart") {
        post_info.class_name = "far fa-heart"
        update_heart(post_info.class_name)
        remove_doc()
      } else {
        post_info.class_name = "fas fa-heart"
        update_heart(post_info.class_name)
        save_doc()
      }
    }
  }
})

var editor = new Vue({
  el: "#editor",
  async mounted() {
    var toolbarOptions = {
      container: [
        [{ header: 1 }, { header: 2 }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block"],
        [{ color: [] }],
        [{ list: "bullet" }],
        ["link", "image"]
      ]
    }

    const placeholder =
      "Start writing.\n\nSelect the text for formatting options."
    quill = new Quill("#editor", {
      modules: {
        toolbar: toolbarOptions
      },
      theme: "bubble",
      placeholder: placeholder
    })

    const hash = parseHash()
    if (hash) {
      try {
        const [password, address] = hash
        quill.enable(false)
        quill.setText("Loading.......")
        post_info.class_name = "far fa-heart"
        post_info.show_post_button = false

        const content = await load(address)
        const data = await decrypt(content, password)
        const document = JSON.parse(data)
        quill.setContents(document)
      } catch (error) {
        quill.setText(`Ooops something went wrong\n\n ${error}`)
      }
    }

    quill.focus()
  }
})
