const query = (obj) =>
  Object.keys(obj)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
const colorThemes = document.querySelectorAll('[name="theme"]');
const markdown = window.markdownit();
const message_box = document.getElementById(`messages`);
const message_input = document.getElementById(`message-input`);
const box_conversations = document.querySelector(`.top`);
const spinner = box_conversations.querySelector(".spinner");
const stop_generating = document.querySelector(`.stop_generating`);
const send_button = document.querySelector(`#send-button`);
let prompt_lock = false;
let apiKey = null;
let clientIdx = null;
let clientType = null;
let fileConversionContent = [];


//


const url = "https://claude3.edu.cn.ucas.life";
const apiRoute = "/api/v1";
const chatRoute =  "/claude/chat";
const documentConversionRoute = "/claude/convert_document";
// "/api/v1/claude/chat";

const streamingUrl = `${url}${apiRoute}${chatRoute}`;
const documentConversionUrl = `${url}${apiRoute}${documentConversionRoute}`;
let conversationID = null;

function log_out() {
  localStorage.removeItem('SJ_API_KEY');

  var baseUrl = window.location.protocol + '//' + window.location.host;

  // 构建目标页面的完整URL
  var targetUrl = baseUrl;
  window.location.href = targetUrl;


  
}


function triggerFileUpload() {
  document.getElementById('fileInput').click();
}


function handleFiles(files) {
  if (files.length > 0) {
    var file = files[0];
    var formData = new FormData();
    formData.append('file', file);

    // 使用fetch API发送文件
    fetch(documentConversionUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': apiKey
    },
    })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', data);
      // 判断键值对 'error' 在不在data里面
      if ('error' in data) {
        alert("上传失败,不支持该文件格式");
        // 然后直接返回吗？
        return;
      }
      fileConversionContent.push(data);
      alert("上传成功");
    })
    .catch((error) => {
      console.error('Error:', error);
      alert("上传失败,不支持该文件格式");
    });
  }
}



function switch_account(){
  var baseUrl = window.location.protocol + '//' + window.location.host;
  var targetUrl = baseUrl + '/claude/status' + '?api_key=' + apiKey;
  window.location.href = targetUrl;  
}


function generatePayLoad(message) {
  const chosenModel = $("#model option:selected").val();
  var payload = {
    "stream": true,
    "model": chosenModel,
    "message": message,
    "client_idx": clientIdx,
    "client_type": clientType
  };
  // fileConversionContent
  if(fileConversionContent.length > 0) {
    payload['attachments'] = fileConversionContent;
  }

  if (conversationID === null) {

  }
  else {
    payload["conversation_id"] = conversationID;
  }

  return payload;

 
}
function getQueryParam(key) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
}


async function fetchStreamData(url, payload) {

    // 这里能从     localStorage.setItem('SJ_API_KEY', apiKey);
   // 这个地方获取吗？

  //  alert(apiKey);
   
   console.log(conversationID);
    var responseText = "";
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // 指定请求体格式为 JSON
                'Authorization': apiKey
            },
            body: JSON.stringify(payload) // 将 payload 对象转换为 JSON 字符串
        });

        const reader = response.body.getReader();
        const stream = new ReadableStream({
            async start(controller) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    controller.enqueue(value);
                    let text = new TextDecoder().decode(value);
                    if (text.startsWith('<')) {
                        const regex = /<.*?>/;
                        const match = text.match(regex);
                        if (match) {
                            if (conversationID === null) {
                                conversationID = match[0].slice(1, -1);
                            }
                            // replace the match part with empty string
                            text = text.replace(regex, '');
                        }
                    }
                    // 使用marked.js将Markdown转换为HTML
                    responseText = responseText + text;
                    // element.html(htmlText);
                    document.getElementById(`gpt_${window.token}`).innerHTML =
                    markdown.render(responseText);
                }
                document.querySelectorAll(`code`).forEach((el) => {
                  hljs.highlightElement(el);
                });
                add_message(window.conversation_id, "assistant", responseText); 
                window.scrollTo(0, 0);
                message_box.scrollTo({ top: message_box.scrollHeight, behavior: "auto" });
                controller.close();
                reader.releaseLock();
                // 如果文件非空
                if (fileConversionContent.length > 0) {
                  fileConversionContent = [];
                }
            }
        });
        await new Response(stream).text(); // 确保流完全处理完毕
    } catch (error) {
        console.error('Error fetching stream data:', error);
    }
}


//


hljs.addPlugin(new CopyButtonPlugin());

function resizeTextarea(textarea) {
  textarea.style.height = '80px';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

const format = (text) => {
  return text.replace(/(?:\r\n|\r|\n)/g, "<br>");
};

message_input.addEventListener("blur", () => {
  window.scrollTo(0, 0);
});

message_input.addEventListener("focus", () => {
  document.documentElement.scrollTop = document.documentElement.scrollHeight;
});

const delete_conversations = async () => {
  localStorage.clear();
  await new_conversation();
};

const handle_ask = async () => {
  message_input.style.height = `80px`;
  message_input.focus();

  window.scrollTo(0, 0);
  let message = message_input.value;

  if (message.length > 0) {
    message_input.value = ``;
    await ask_gpt(message);
  }
};

const remove_cancel_button = async () => {
  stop_generating.classList.add(`stop_generating-hiding`);

  setTimeout(() => {
    stop_generating.classList.remove(`stop_generating-hiding`);
    stop_generating.classList.add(`stop_generating-hidden`);
  }, 300);
};

const ask_gpt = async (message) => {
  try {
    message_input.value = ``;
    message_input.innerHTML = ``;
    message_input.innerText = ``;

    add_conversation(window.conversation_id, message.substr(0, 20));
    window.scrollTo(0, 0);
    window.controller = new AbortController();

    jailbreak = document.getElementById("jailbreak");
    model = document.getElementById("model");
    prompt_lock = true;
    window.text = ``;
    window.token = message_id();

    stop_generating.classList.remove(`stop_generating-hidden`);

    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${user_image}
                    <i class="fa-regular fa-phone-arrow-up-right"></i>
                </div>
                <div class="content" id="user_${token}"> 
                    ${format(message)}
                </div>
            </div>
        `;

    /* .replace(/(?:\r\n|\r|\n)/g, '<br>') */

    message_box.scrollTop = message_box.scrollHeight;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, 0);

    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${gpt_image} <i class="fa-regular fa-phone-arrow-down-left"></i>
                </div>
                <div class="content" id="gpt_${window.token}">
                    <div id="cursor"></div>
                </div>
            </div>
        `;

    message_box.scrollTop = message_box.scrollHeight;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 1000));
    window.scrollTo(0, 0);
    const payload = generatePayLoad(message);
    await fetchStreamData(streamingUrl, payload);
    // const response = await fetch(`/backend-api/v2/conversation`, {
    //   method: `POST`,
    //   signal: window.controller.signal,
    //   headers: {
    //     "content-type": `application/json`,
    //     accept: `text/event-stream`,
    //   },
    //   body: JSON.stringify({
    //     conversation_id: window.conversation_id,
    //     action: `_ask`,
    //     model: model.options[model.selectedIndex].value,
    //     jailbreak: jailbreak.options[jailbreak.selectedIndex].value,
    //     meta: {
    //       id: window.token,
    //       content: {
    //         conversation: await get_conversation(window.conversation_id),
    //         internet_access: document.getElementById("switch").checked,
    //         content_type: "text",
    //         parts: [
    //           {
    //             content: message,
    //             role: "user",
    //           },
    //         ],
    //       },
    //     },
    //   }),
    // });

    // const reader = response.body.getReader();

    // while (true) {
    //   const { value, done } = await reader.read();
    //   if (done) break;

    //   chunk = new TextDecoder().decode(value);

    //   if (
    //     chunk.includes(
    //       `<form id="challenge-form" action="/backend-api/v2/conversation?`
    //     )
    //   ) {
    //     chunk = `cloudflare token expired, please refresh the page.`;
    //   }

    //   text += chunk;

    //   const objects         = chunk.match(/({.+?})/g);

    //   try { if (JSON.parse(objects[0]).success === false) throw new Error(JSON.parse(objects[0]).error) } catch (e) {}

    //   objects.forEach((object) => {
    //       console.log(object)
    //       try { text += h2a(JSON.parse(object).content) } catch(t) { console.log(t); throw new Error(t)}
    //   });

    //   document.getElementById(`gpt_${window.token}`).innerHTML =
    //     markdown.render(text);
    //   document.querySelectorAll(`code`).forEach((el) => {
    //     hljs.highlightElement(el);
    //   });

    //   window.scrollTo(0, 0);
    //   message_box.scrollTo({ top: message_box.scrollHeight, behavior: "auto" });
    // }

    // if text contains :
    // if (
    //   text.includes(
    //     `instead. Maintaining this website and API costs a lot of money`
    //   )
    // ) {
    //   document.getElementById(`gpt_${window.token}`).innerHTML =
    //     "An error occured, please reload / refresh cache and try again.";
    // }

    add_message(window.conversation_id, "user", message);

    message_box.scrollTop = message_box.scrollHeight;
    await remove_cancel_button();
    prompt_lock = false;

    await load_conversations(20, 0);
    window.scrollTo(0, 0);
  } catch (e) {
    add_message(window.conversation_id, "user", message);

    message_box.scrollTop = message_box.scrollHeight;
    await remove_cancel_button();
    prompt_lock = false;

    await load_conversations(20, 0);

    console.log(e);

    let cursorDiv = document.getElementById(`cursor`);
    if (cursorDiv) cursorDiv.parentNode.removeChild(cursorDiv);

    if (e.name != `AbortError`) {
      let error_message = `oops ! something went wrong, please try again / reload. [stacktrace in console]`;

      document.getElementById(`gpt_${window.token}`).innerHTML = error_message;
      add_message(window.conversation_id, "assistant", error_message);
    } else {
      document.getElementById(`gpt_${window.token}`).innerHTML += ` [aborted]`;
      add_message(window.conversation_id, "assistant", text + ` [aborted]`);
    }

    window.scrollTo(0, 0);
  }
};

const clear_conversations = async () => {
  const elements = box_conversations.childNodes;
  let index = elements.length;

  if (index > 0) {
    while (index--) {
      const element = elements[index];
      if (
        element.nodeType === Node.ELEMENT_NODE &&
        element.tagName.toLowerCase() !== `button`
      ) {
        box_conversations.removeChild(element);
      }
    }
  }
};

const clear_conversation = async () => {
  let messages = message_box.getElementsByTagName(`div`);

  while (messages.length > 0) {
    message_box.removeChild(messages[0]);
  }
};

const show_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  conv.style.display = "none";
  yes.style.display = "block";
  not.style.display = "block"; 
}

const hide_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  conv.style.display = "block";
  yes.style.display = "none";
  not.style.display = "none"; 
}

const delete_conversation = async (conversation_id) => {
  localStorage.removeItem(`conversation:${conversation_id}`);

  const conversation = document.getElementById(`convo-${conversation_id}`);
    conversation.remove();

  if (window.conversation_id == conversation_id) {
    await new_conversation();
  }

  await load_conversations(20, 0, true);
};

const set_conversation = async (conversation_id) => {
  history.pushState({}, null, `/chat/${conversation_id}`);
  window.conversation_id = conversation_id;

  await clear_conversation();
  await load_conversation(conversation_id);
  await load_conversations(20, 0, true);
};

const new_conversation = async () => {
  history.pushState({}, null, `/chat/`);
  // new_conversation
  window.conversation_id = uuid();
  if(conversationID !== null) {
    conversationID = null;
  }

  await clear_conversation();
  await load_conversations(20, 0, true);
};

const load_conversation = async (conversation_id) => {
  let conversation = await JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );
  console.log(conversation, conversation_id);

  // TODO: change the iteration rank of the user and the assistant. 
  for (item of conversation.items) {
    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${item.role == "assistant" ? gpt_image : user_image}
                    ${
                      item.role == "assistant"
                        ? `<i class="fa-regular fa-phone-arrow-down-left"></i>`
                        : `<i class="fa-regular fa-phone-arrow-up-right"></i>`
                    }
                </div>
                <div class="content">
                    ${
                      item.role == "assistant"
                        ? markdown.render(item.content)
                        : item.content
                    }
                </div>
            </div>
        `;
  }

  document.querySelectorAll(`code`).forEach((el) => {
    hljs.highlightElement(el);
  });

  message_box.scrollTo({ top: message_box.scrollHeight, behavior: "smooth" });

  setTimeout(() => {
    message_box.scrollTop = message_box.scrollHeight;
  }, 500);
};

const get_conversation = async (conversation_id) => {
  let conversation = await JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );
  return conversation.items;
};

const add_conversation = async (conversation_id, title) => {
  if (localStorage.getItem(`conversation:${conversation_id}`) == null) {
    localStorage.setItem(
      `conversation:${conversation_id}`,
      JSON.stringify({
        id: conversation_id,
        title: title,
        items: [],
      })
    );
  }
};

const add_message = async (conversation_id, role, content) => {
  before_adding = JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );

  before_adding.items.push({
    role: role,
    content: content,
  });

  localStorage.setItem(
    `conversation:${conversation_id}`,
    JSON.stringify(before_adding)
  ); // update conversation
};

const load_conversations = async (limit, offset, loader) => {
  //console.log(loader);
  //if (loader === undefined) box_conversations.appendChild(spinner);

  let conversations = [];
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith("conversation:")) {
      let conversation = localStorage.getItem(localStorage.key(i));
      conversations.push(JSON.parse(conversation));
    }
  }

  //if (loader === undefined) spinner.parentNode.removeChild(spinner)
  await clear_conversations();

  for (conversation of conversations) {
    box_conversations.innerHTML += `
    <div class="convo" id="convo-${conversation.id}">
      <div class="left" onclick="set_conversation('${conversation.id}')">
          <i class="fa-regular fa-comments"></i>
          <span class="convo-title">${conversation.title}</span>
      </div>
      <i onclick="show_option('${conversation.id}')" class="fa-regular fa-trash" id="conv-${conversation.id}"></i>
      <i onclick="delete_conversation('${conversation.id}')" class="fa-regular fa-check" id="yes-${conversation.id}" style="display:none;"></i>
      <i onclick="hide_option('${conversation.id}')" class="fa-regular fa-x" id="not-${conversation.id}" style="display:none;"></i>
    </div>
    `;
  }

  document.querySelectorAll(`code`).forEach((el) => {
    hljs.highlightElement(el);
  });
};

document.getElementById(`cancelButton`).addEventListener(`click`, async () => {
  window.controller.abort();
  console.log(`aborted ${window.conversation_id}`);
});

function h2a(str1) {
  var hex = str1.toString();
  var str = "";

  for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }

  return str;
}

const uuid = () => {
  return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(
    /[xy]/g,
    function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
};

const message_id = () => {
  random_bytes = (Math.floor(Math.random() * 1338377565) + 2956589730).toString(
    2
  );
  unix = Math.floor(Date.now() / 1000).toString(2);

  return BigInt(`0b${unix}${random_bytes}`).toString();
};

function readAPIKey() {
  apiKey = localStorage.getItem('SJ_API_KEY');
  //  alert(apiKey);
   if (apiKey == null || apiKey == undefined || apiKey == "null" || apiKey == "undefined")  {
     apiKey = getQueryParam('api_key');
     localStorage.setItem('SJ_API_KEY', apiKey);
   }
   console.log(`API Key: ${apiKey}`);
}

function readClientInfo(){
  clientIdx = getQueryParam('client_idx');
  clientType = getQueryParam('client_type');
  if (clientIdx == null || clientIdx == undefined || clientIdx == "null" || clientIdx == "undefined" || clientType == null || clientType == undefined || clientType == "null" || clientType == "undefined") {
    alert("请从选号页面进入聊天室");
  }  
  console.log(`Client Info: ${clientIdx} ${clientType}`);
  

}


window.onload = async () => {
  readAPIKey();
  readClientInfo();
  load_settings_localstorage();

  conversations = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith("conversation:")) {
      conversations += 1;
    }
  }

  if (conversations == 0) localStorage.clear();

  await setTimeout(() => {
    load_conversations(20, 0);
  }, 1);

  if (!window.location.href.endsWith(`#`)) {
    if (/\/chat\/.+/.test(window.location.href)) {
      await load_conversation(window.conversation_id);
    }
  }

message_input.addEventListener(`keydown`, async (evt) => {
    if (prompt_lock) return;
    if (evt.keyCode === 13 && !evt.shiftKey) {
        evt.preventDefault();
        console.log('pressed enter');
        await handle_ask();
    } else {
      message_input.style.removeProperty("height");
      message_input.style.height = message_input.scrollHeight + 4 + "px";
    }
  });

  send_button.addEventListener(`click`, async () => {
    console.log("clicked send");
    if (prompt_lock) return;
    await handle_ask();
  });

  register_settings_localstorage();
};

document.querySelector(".mobile-sidebar").addEventListener("click", (event) => {
  const sidebar = document.querySelector(".conversations");

  if (sidebar.classList.contains("shown")) {
    sidebar.classList.remove("shown");
    event.target.classList.remove("rotated");
  } else {
    sidebar.classList.add("shown");
    event.target.classList.add("rotated");
  }

  window.scrollTo(0, 0);
});

const register_settings_localstorage = async () => {
  settings_ids = ["switch", "model", "jailbreak"];
  settings_elements = settings_ids.map((id) => document.getElementById(id));
  settings_elements.map((element) =>
    element.addEventListener(`change`, async (event) => {
      switch (event.target.type) {
        case "checkbox":
          localStorage.setItem(event.target.id, event.target.checked);
          break;
        case "select-one":
          localStorage.setItem(event.target.id, event.target.selectedIndex);
          break;
        default:
          console.warn("Unresolved element type");
      }
    })
  );
};

const load_settings_localstorage = async () => {
  settings_ids = ["switch", "model", "jailbreak"];
  settings_elements = settings_ids.map((id) => document.getElementById(id));
  settings_elements.map((element) => {
    if (localStorage.getItem(element.id)) {
      switch (element.type) {
        case "checkbox":
          element.checked = localStorage.getItem(element.id) === "true";
          break;
        case "select-one":
          element.selectedIndex = parseInt(localStorage.getItem(element.id));
          break;
        default:
          console.warn("Unresolved element type");
      }
    }
  });
};

// Theme storage for recurring viewers
const storeTheme = function (theme) {
  localStorage.setItem("theme", theme);
};

// set theme when visitor returns
const setTheme = function () {
  const activeTheme = localStorage.getItem("theme");
  colorThemes.forEach((themeOption) => {
    if (themeOption.id === activeTheme) {
      themeOption.checked = true;
    }
  });
  // fallback for no :has() support
  document.documentElement.className = activeTheme;
};

colorThemes.forEach((themeOption) => {
  themeOption.addEventListener("click", () => {
    storeTheme(themeOption.id);
    // fallback for no :has() support
    document.documentElement.className = themeOption.id;
  });
});

document.onload = setTheme();
