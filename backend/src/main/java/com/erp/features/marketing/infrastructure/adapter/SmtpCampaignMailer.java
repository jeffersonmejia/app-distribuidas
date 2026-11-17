package com.erp.features.marketing.infrastructure.adapter;

import com.erp.features.marketing.application.port.out.CampaignMailer;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

//SOLID: SRP — ESTE ADAPTADOR ENTREGA CORREOS DE CAMPAÑA POR SMTP (GMAIL) CON VERSIONES HTML Y TEXTO.
@Component
public class SmtpCampaignMailer implements CampaignMailer {
    private final JavaMailSender sender;
    private final String from;

    public SmtpCampaignMailer(JavaMailSender sender, @Value("${spring.mail.username:}") String from) {
        this.sender = sender;
        this.from = from;
    }

    @Override public void send(String to, String subject, String html, String text) {
        if (from.isBlank()) { throw new IllegalStateException("smtp account is not configured"); }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            sender.send(message);
        } catch (MessagingException exception) {
            // Sin causa ni mensaje original: pueden incluir la dirección del destinatario.
            throw new IllegalStateException("mail message could not be built");
        }
    }
}
