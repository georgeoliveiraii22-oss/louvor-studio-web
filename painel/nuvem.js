// Áudio na nuvem (migração 0017): arquivos novos vão para o Cloudflare R2 pela Edge Function `r2`
// (links temporários); os antigos continuam no bucket `audio` do Supabase. Igual ao app Android
// (data/Supa.kt: sendAudio / audioUrl). Nas linhas lidas do banco, `Nuvem.mark` troca o object_key
// dos arquivos do R2 por "r2:<id do arquivo>", e `Nuvem.signedUrl` sabe baixar os dois.
(function (root) {
  // Colunas de `files` que as consultas precisam pedir para saber onde o arquivo mora.
  var FILE_COLS = 'id,object_key,bucket';

  function mark(rows) {
    (rows || []).forEach(function (r) {
      ['file', 'source_file'].forEach(function (k) {
        var f = r && r[k];
        if (f && f.bucket === 'r2' && f.id) f.object_key = 'r2:' + f.id;
      });
    });
    return rows;
  }

  async function call(sb, body) {
    var res = await sb.functions.invoke('r2', { body: body });
    if (res.error) {
      var msg = res.error.message;
      try { var j = await res.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* sem corpo */ }
      var err = new Error(msg);
      err.status = res.error.context && res.error.context.status;
      throw err;
    }
    return res.data;
  }

  // Mesmo formato de sb.storage.from('audio').createSignedUrl: { data: { signedUrl }, error }.
  async function signedUrl(sb, key, secs) {
    key = String(key || '');
    if (key.indexOf('r2:') !== 0) return sb.storage.from('audio').createSignedUrl(key, secs || 3600);
    var id = key.slice(3);
    try {
      var d = await call(sb, { action: 'download', file_ids: [id] });
      var u = d && d.urls && d.urls[id];
      return u ? { data: { signedUrl: u }, error: null } : { data: null, error: { message: 'Você não tem acesso a este arquivo.' } };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }

  // Cadastra o arquivo (row = linha de `files`, sem bucket), envia ao R2 e confirma. Lança erro se falhar.
  async function uploadAudio(sb, row, blob) {
    row.bucket = 'r2';
    var ins = await sb.from('files').insert(row);
    if (ins.error) throw ins.error;
    var up = await call(sb, { action: 'upload', file_id: row.id });
    var put = await fetch(up.url, { method: 'PUT', body: blob, headers: { 'Content-Type': row.mime } });
    if (!put.ok) throw new Error('Falha ao enviar para a nuvem (' + put.status + ').');
    await call(sb, { action: 'confirm', file_id: row.id, checksum: row.checksum_sha256 });
  }

  // Apaga os arquivos da própria pessoa (ao excluir a conta): `files` = [{ id, object_key, bucket }].
  async function removeMine(sb, files) {
    var r2 = (files || []).filter(function (f) { return f && f.bucket === 'r2'; }).map(function (f) { return f.id; });
    var old = (files || []).filter(function (f) { return f && f.bucket !== 'r2' && f.object_key; }).map(function (f) { return f.object_key; });
    if (r2.length) { try { await call(sb, { action: 'delete', file_ids: r2 }); } catch (e) { /* segue a exclusão */ } }
    if (old.length) await sb.storage.from('audio').remove(old);
  }

  root.Nuvem = { FILE_COLS: FILE_COLS, mark: mark, signedUrl: signedUrl, uploadAudio: uploadAudio, removeMine: removeMine };
})(typeof window !== 'undefined' ? window : globalThis);
