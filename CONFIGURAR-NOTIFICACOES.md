# Notificações push da MK Braids

## Estado da configuração

As migrações de push já foram aplicadas no Supabase conectado e a Edge Function `send-new-appointment-push` está publicada na versão 2. As chaves VAPID, o segredo do webhook e o endereço da função estão guardados no Supabase Vault. A chave privada não está nos arquivos do projeto; somente a chave pública aparece no painel.

## Publicar os arquivos do painel

Publique no mesmo destino usado hoje pelo MK Braids os arquivos atualizados `index.html`, `service-worker.js` e `manifest.json`. Mantenha o painel em HTTPS e no caminho `/mk-braids-admin/`, que é o escopo esperado pelo PWA e pelo toque da notificação.

O arquivo ZIP entregue contém o projeto atualizado e este guia. Ele não inclui o histórico `.git`; extraia os arquivos na cópia local do repositório e publique pelo fluxo atual.

## Ativar no Android

1. Abra o painel atualizado no Chrome do celular e entre com a conta administrativa.
2. Toque em **Ativar notificações** e permita os avisos.
3. Instale o painel na tela inicial como PWA, se ainda não estiver instalado.
4. Envie um pedido de teste pelo site de clientes. O aviso deve chegar mesmo com o painel fechado.

O botão também permite desativar os avisos naquele celular. A inscrição pertence à conta administrativa e as políticas RLS limitam cada conta às próprias inscrições.

## Se configurar outro projeto Supabase

Use as quatro migrações em ordem, publique a Edge Function e crie no Vault os segredos `push_function_url`, `push_webhook_secret`, `vapid_public_key`, `vapid_private_key` e `vapid_subject`. Gere uma nova chave VAPID para cada projeto e coloque no painel somente a parte pública. Mantenha a privada e o segredo do webhook apenas no Vault. A função obtém a chave `service_role` pelo ambiente do servidor; ela não deve ser copiada para o HTML ou para o aplicativo.

O gatilho escuta apenas novos `INSERT` em `public.agendamentos`, que é a tabela usada pelo pedido feito no site. Os lançamentos manuais usam `public.agenda_mk` e ficam fora do gatilho. Aprovar ou recusar um pedido também não envia outro aviso.
