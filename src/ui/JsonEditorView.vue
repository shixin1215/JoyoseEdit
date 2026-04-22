<template>
  <div class="stack">
    <div class="panel">
      <h2>JSON 编辑<br>
        <small>直接改 params / rule_content</small>
      </h2>
      <div class="row">
        <label class="row" style="gap: 6px">
          <span class="tiny muted">目标</span>
          <select v-model="target">
            <option v-for="name in cloudConfigNames" :key="name" :value="'cc:' + name">
              cloud_config.{{ name }}.params
            </option>
            <option v-for="mod in rulesModules" :key="mod" :value="'rule:' + mod">
              teg_config.rules[{{ mod }}].rule_content
            </option>
          </select>
        </label>
        <button class="primary" @click="apply" :disabled="!editor || !isValidJson">应用到内存</button>
        <button class="ghost" @click="reset">重置为最新值</button>
      </div>
    </div>

    <div class="panel">
      <div class="cm-shell" ref="editorRoot" />
      <div v-if="!isValidJson" class="tiny" style="color: var(--warn); margin-top: 6px">
        ⚠ JSON 无法解析：{{ parseError }}
      </div>
      <div v-else class="tiny muted" style="margin-top: 6px">
        JSON 合法 · {{ codeLength }} 字符
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { state, markDirty } from '@/state/session';
import { toast } from '@/state/toast';
// CodeMirror is the biggest single contributor to bundle size and is only
// used in this view — defer all imports until the view actually mounts.
import type { EditorView } from 'codemirror';

const target = ref<string>('');
const editorRoot = ref<HTMLElement | null>(null);
const editor = ref<EditorView | null>(null);
const isValidJson = ref(true);
const parseError = ref('');
const codeLength = ref(0);

const cloudConfigNames = computed(() => Object.keys(state.cloudConfig));
const rulesModules = computed(() => Object.keys(state.rulesByModule));

watch(cloudConfigNames, (names) => {
  if (!target.value && names.length > 0) target.value = 'cc:' + names[0];
}, { immediate: true });

watch(target, () => reset(), { immediate: true });

function currentText(): string {
  if (!target.value) return '';
  const [kind, name] = target.value.split(':');
  if (kind === 'cc') {
    return JSON.stringify(state.cloudConfig[name]?.params ?? {}, null, 2);
  }
  const rows = state.rulesByModule[name] ?? [];
  return JSON.stringify(rows.map((r) => r.content), null, 2);
}

function reset() {
  const text = currentText();
  if (!editor.value) return;
  editor.value.dispatch({
    changes: { from: 0, to: editor.value.state.doc.length, insert: text },
  });
  isValidJson.value = true;
  parseError.value = '';
  codeLength.value = text.length;
}

async function mountEditor() {
  await nextTick();
  if (!editorRoot.value || editor.value) return;
  const [{ EditorView: EV, basicSetup }, { json }, { oneDark }, { EditorState }] =
    await Promise.all([
      import('codemirror'),
      import('@codemirror/lang-json'),
      import('@codemirror/theme-one-dark'),
      import('@codemirror/state'),
    ]);
  editor.value = new EV({
    state: EditorState.create({
      doc: currentText(),
      extensions: [
        basicSetup,
        json(),
        oneDark,
        EV.updateListener.of((v) => {
          if (!v.docChanged) return;
          const text = v.state.doc.toString();
          codeLength.value = text.length;
          try {
            JSON.parse(text);
            isValidJson.value = true;
            parseError.value = '';
          } catch (err: any) {
            isValidJson.value = false;
            parseError.value = err?.message ?? String(err);
          }
        }),
      ],
    }),
    parent: editorRoot.value,
  });
  codeLength.value = editor.value.state.doc.length;
}

watch(editorRoot, (el) => {
  if (el) mountEditor();
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});

function apply() {
  if (!editor.value) return;
  const text = editor.value.state.doc.toString();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    toast.fromError(err, 'JSON 解析失败');
    return;
  }
  const [kind, name] = target.value.split(':');
  if (kind === 'cc') {
    if (!state.cloudConfig[name]) return;
    state.cloudConfig[name].params = parsed;
  } else {
    const rows = state.rulesByModule[name] ?? [];
    if (!Array.isArray(parsed) || parsed.length !== rows.length) {
      toast.error(`格式错误`, `必须是包含 ${rows.length} 个 rule_content 的 JSON 数组`);
      return;
    }
    for (let i = 0; i < rows.length; i++) rows[i].content = parsed[i];
  }
  markDirty();
  toast.success('已应用到内存', '使用顶部"提交到设备"按钮写入 DB');
}
</script>
